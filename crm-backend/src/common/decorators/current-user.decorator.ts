import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export interface JwtUser {
  id: string;
  email: string;
  tenantId: string;
  role: string;
}

/**
 * @CurrentUser() - Extracts the authenticated user from the request
 * Example: @CurrentUser() user: JwtUser
 * Example: @CurrentUser('id') userId: string
 */
export const CurrentUser = createParamDecorator(
  (data: keyof JwtUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request & { user: JwtUser }>();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
