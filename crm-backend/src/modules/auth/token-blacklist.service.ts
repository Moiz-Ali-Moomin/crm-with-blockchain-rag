/**
 * Token Blacklist Service
 * Stores revoked access tokens in Redis until their natural expiry.
 * Uses JWT's own expiry to auto-expire the blacklist entry.
 */

import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../../core/cache/redis.service';
import { CACHE_KEYS } from '../../core/cache/cache-keys';

@Injectable()
export class TokenBlacklistService {
  constructor(
    private readonly redis: RedisService,
    private readonly jwtService: JwtService,
  ) {}

  async add(token: string): Promise<void> {
    try {
      // Decode without verification to get expiry
      const decoded = this.jwtService.decode(token) as { exp: number; jti?: string };
      if (!decoded?.exp) return;

      const ttlSeconds = decoded.exp - Math.floor(Date.now() / 1000);
      if (ttlSeconds <= 0) return; // Already expired, no need to blacklist

      // Use jti if available, otherwise use a hash of the token
      const key = CACHE_KEYS.tokenBlacklist(decoded.jti ?? token.slice(-20));
      await this.redis.set(key, '1', ttlSeconds);
    } catch {
      // If decode fails, token is already invalid - ignore
    }
  }

  async isBlacklisted(token: string): Promise<boolean> {
    try {
      const decoded = this.jwtService.decode(token) as { jti?: string };
      const key = CACHE_KEYS.tokenBlacklist(decoded?.jti ?? token.slice(-20));
      return this.redis.exists(key);
    } catch {
      return false;
    }
  }
}
