import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * @Public() - Marks a route as publicly accessible (skips JwtAuthGuard)
 * Use on auth endpoints like login, register, password reset
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
