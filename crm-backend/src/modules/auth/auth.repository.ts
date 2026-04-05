import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { randomBytes, createHash } from 'crypto';
import { addHours } from 'date-fns';

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string) {
    // Auth queries bypass tenant scope (email is unique across tenants)
    return this.prisma.withoutTenantScope(() =>
      this.prisma.user.findFirst({
        where: { email },
        include: { tenant: true },
      }),
    );
  }

  async findById(id: string) {
    return this.prisma.withoutTenantScope(() =>
      this.prisma.user.findUnique({ where: { id } }),
    );
  }

  async findTenantBySlug(slug: string) {
    return this.prisma.withoutTenantScope(() =>
      this.prisma.tenant.findUnique({ where: { slug } }),
    );
  }

  async updateRefreshToken(userId: string, hash: string) {
    return this.prisma.withoutTenantScope(() =>
      this.prisma.user.update({
        where: { id: userId },
        data: { refreshTokenHash: hash },
      }),
    );
  }

  async clearRefreshToken(userId: string) {
    return this.prisma.withoutTenantScope(() =>
      this.prisma.user.update({
        where: { id: userId },
        data: { refreshTokenHash: null },
      }),
    );
  }

  async updateLastLogin(userId: string) {
    return this.prisma.withoutTenantScope(() =>
      this.prisma.user.update({
        where: { id: userId },
        data: { lastLoginAt: new Date() },
      }),
    );
  }

  async updatePassword(userId: string, passwordHash: string) {
    return this.prisma.withoutTenantScope(() =>
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash, settings: {} }, // Clear passwordResetTokenHash stored in settings
      }),
    );
  }

  async createPasswordResetToken(userId: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
    // Store SHA-256 hash — raw token is never persisted (same pattern as refresh tokens)
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = addHours(new Date(), 1); // 1 hour expiry

    await this.prisma.withoutTenantScope(() =>
      this.prisma.user.update({
        where: { id: userId },
        data: {
          settings: {
            passwordResetTokenHash: tokenHash,
            passwordResetExpires: expiresAt.toISOString(),
          },
        },
      }),
    );

    return token; // Return raw token — goes into the email link, never stored
  }

  async findByResetToken(token: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const users = await this.prisma.withoutTenantScope(() =>
      this.prisma.user.findMany({
        where: {
          settings: {
            path: ['passwordResetTokenHash'],
            equals: tokenHash,
          },
        },
      }),
    );

    const user = users[0];
    if (!user) return null;

    const settings = user.settings as Record<string, string>;
    const expires = new Date(settings.passwordResetExpires);

    if (expires < new Date()) return null; // Token expired

    return user;
  }
}
