import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthGuard } from '@nestjs/passport';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  RegisterDto, RegisterSchema,
  LoginDto, LoginSchema,
  ForgotPasswordDto, ForgotPasswordSchema,
  ResetPasswordDto, ResetPasswordSchema,
} from './auth.dto';
import { Request } from 'express';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register new organization + admin user' })
  async register(@Body(new ZodValidationPipe(RegisterSchema)) dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email/password' })
  async login(@Body(new ZodValidationPipe(LoginSchema)) dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @UseGuards(AuthGuard('jwt-refresh'))
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  async refresh(@Req() req: Request & { user: { id: string; refreshToken: string } }) {
    return this.authService.refreshTokens(req.user.id, req.user.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Logout - invalidates current session' })
  async logout(
    @CurrentUser('id') userId: string,
    @Req() req: Request,
  ) {
    const token = req.headers.authorization?.replace('Bearer ', '') ?? '';
    await this.authService.logout(userId, token);
    return { message: 'Logged out successfully' };
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset email' })
  async forgotPassword(
    @Body(new ZodValidationPipe(ForgotPasswordSchema)) dto: ForgotPasswordDto,
  ) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using token from email' })
  async resetPassword(
    @Body(new ZodValidationPipe(ResetPasswordSchema)) dto: ResetPasswordDto,
  ) {
    return this.authService.resetPassword(dto);
  }
}
