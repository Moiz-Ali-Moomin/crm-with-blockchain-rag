import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER)
 * Used with RolesGuard to enforce role-based access control
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
