import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { TokenBlacklistService } from './token-blacklist.service';
import { QUEUE_NAMES } from '../../core/queue/queue.constants';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    BullModule.registerQueue({ name: QUEUE_NAMES.EMAIL }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '15m') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthRepository,
    JwtStrategy,
    JwtRefreshStrategy,
    TokenBlacklistService,
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
