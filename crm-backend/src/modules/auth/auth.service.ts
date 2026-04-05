/**
 * Auth Service
 *
 * Token strategy:
 * - Access token: 15min JWT, contains userId/tenantId/role
 * - Refresh token: 7day JWT, stored as bcrypt hash in DB
 * - Refresh token rotation: each use issues a NEW token and invalidates old one
 * - Reuse detection: if a used token is re-submitted, ALL sessions are invalidated
 * - Logout: access token added to Redis blacklist (until natural expiry)
 */

import { Injectable } from '@nestjs/common';
import {
  UnauthorizedError,
  ConflictError,
  BusinessRuleError,
} from '../../shared/errors/domain.errors';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as bcrypt from 'bcrypt';
import { AuthRepository } from './auth.repository';
import { TokenBlacklistService } from './token-blacklist.service';
import { PrismaTransactionService } from '../../core/database/prisma-transaction.service';
import { QUEUE_NAMES, QUEUE_JOB_OPTIONS } from '../../core/queue/queue.constants';
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './auth.dto';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepo: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly blacklist: TokenBlacklistService,
    private readonly tx: PrismaTransactionService,
    @InjectQueue(QUEUE_NAMES.EMAIL) private readonly emailQueue: Queue,
  ) {}

  async register(dto: RegisterDto) {
    // Check slug uniqueness
    const existingTenant = await this.authRepo.findTenantBySlug(dto.organizationSlug);
    if (existingTenant) {
      throw new ConflictError('An organization with this slug already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    // Create tenant + admin user + default pipeline in a single transaction
    const { user, tenant } = await this.tx.run(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.organizationName,
          slug: dto.organizationSlug,
        },
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: dto.email.toLowerCase(),
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: 'ADMIN', // First user in org is always ADMIN
        },
      });

      // Create default sales pipeline for new tenant
      const pipeline = await tx.pipeline.create({
        data: {
          tenantId: tenant.id,
          name: 'Sales Pipeline',
          isDefault: true,
        },
      });

      // Create default stages
      const defaultStages = [
        { name: 'Lead', position: 0, probability: 0.1, color: '#94a3b8' },
        { name: 'Qualified', position: 1, probability: 0.3, color: '#60a5fa' },
        { name: 'Proposal', position: 2, probability: 0.5, color: '#a78bfa' },
        { name: 'Negotiation', position: 3, probability: 0.7, color: '#fb923c' },
        { name: 'Closed Won', position: 4, probability: 1.0, color: '#4ade80', isWon: true },
        { name: 'Closed Lost', position: 5, probability: 0.0, color: '#f87171', isLost: true },
      ];

      await tx.stage.createMany({
        data: defaultStages.map((s) => ({
          ...s,
          pipelineId: pipeline.id,
          tenantId: tenant.id,
        })),
      });

      return { user, tenant };
    });

    const tokens = await this.generateTokens(user.id, user.email, tenant.id, user.role);

    return {
      user: this.sanitizeUser(user),
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.authRepo.findByEmail(dto.email.toLowerCase());

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedError('Account is not active. Contact your administrator.');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.tenantId, user.role);

    // Update last login timestamp
    await this.authRepo.updateLastLogin(user.id);

    return {
      user: this.sanitizeUser(user),
      tenant: { id: user.tenant.id, name: user.tenant.name, slug: user.tenant.slug },
      ...tokens,
    };
  }

  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.authRepo.findById(userId);

    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedError('Access denied - no active session');
    }

    const tokenMatches = await bcrypt.compare(refreshToken, user.refreshTokenHash);

    if (!tokenMatches) {
      // Refresh token reuse detected - invalidate ALL sessions
      await this.authRepo.clearRefreshToken(userId);
      throw new UnauthorizedError(
        'Refresh token reuse detected. All sessions have been invalidated.',
      );
    }

    const tokens = await this.generateTokens(user.id, user.email, user.tenantId, user.role);
    return tokens;
  }

  async logout(userId: string, accessToken: string) {
    // Blacklist the access token in Redis until it naturally expires
    await this.blacklist.add(accessToken);

    // Clear refresh token from DB
    await this.authRepo.clearRefreshToken(userId);
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.authRepo.findByEmail(dto.email.toLowerCase());

    // Always return success to prevent email enumeration attacks
    if (!user) return { message: 'If this email exists, a reset link has been sent.' };

    const resetToken = await this.authRepo.createPasswordResetToken(user.id);

    const resetLink = `${this.config.get('APP_URL', 'http://localhost:3000')}/reset-password?token=${resetToken}`;

    // Enqueue password-reset email — fire-and-forget (response must not depend on SendGrid)
    this.emailQueue
      .add(
        'password-reset',
        {
          to: user.email,
          subject: 'Reset your password',
          html: `<p>Click the link below to reset your password. The link expires in 1 hour.</p><p><a href="${resetLink}">${resetLink}</a></p>`,
          communicationId: null,
        },
        QUEUE_JOB_OPTIONS.email,
      )
      .catch(() => {/* non-fatal — user can request another reset */});

    return { message: 'If this email exists, a reset link has been sent.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.authRepo.findByResetToken(dto.token);

    if (!user) {
      throw new BusinessRuleError('Invalid or expired password reset token');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    await this.authRepo.updatePassword(user.id, passwordHash);

    // Invalidate all existing sessions after password change
    await this.authRepo.clearRefreshToken(user.id);

    return { message: 'Password reset successfully. Please log in.' };
  }

  // ── Private Helpers ────────────────────────────────────────────────────────

  private async generateTokens(
    userId: string,
    email: string,
    tenantId: string,
    role: string,
  ) {
    const payload = { sub: userId, email, tenantId, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>('JWT_SECRET'),
        expiresIn: this.config.get<string>('JWT_EXPIRES_IN', '15m'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
      }),
    ]);

    // Store hashed refresh token in DB
    const refreshTokenHash = await bcrypt.hash(refreshToken, BCRYPT_ROUNDS);
    await this.authRepo.updateRefreshToken(userId, refreshTokenHash);

    return { accessToken, refreshToken };
  }

  private sanitizeUser(user: Record<string, any>) {
    const { passwordHash, refreshTokenHash, ...safe } = user;
    return safe;
  }
}
