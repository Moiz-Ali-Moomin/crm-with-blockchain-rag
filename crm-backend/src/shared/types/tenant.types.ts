/**
 * Tenant & Auth Types
 *
 * Shared interfaces for the multi-tenant context and JWT payloads.
 * Used by:
 *  - TenantContextMiddleware (sets the context)
 *  - JwtStrategy (validates and attaches to request)
 *  - getCurrentTenantId / getCurrentUserId helpers
 *  - Any service that reads the request-scoped identity
 *
 * No NestJS imports — pure TypeScript.
 */

/** The identity stored in AsyncLocalStorage for the duration of a request */
export interface TenantContext {
  tenantId: string;
  userId?: string;
  /** Set to true for super-admin operations that must bypass row-level tenant scoping */
  bypassScope?: boolean;
}

/** Shape of the JWT access-token payload */
export interface JwtPayload {
  /** Subject — the user's UUID */
  sub: string;
  email: string;
  tenantId: string;
  role: string;
  /** JWT ID — used for token blacklisting on logout */
  jti?: string;
  iat?: number;
  exp?: number;
}

/** Shape of the JWT refresh-token payload (minimal — no role/tenantId) */
export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  iat?: number;
  exp?: number;
}

/** The user object attached to request.user after JWT validation */
export interface AuthenticatedUser {
  id: string;
  email: string;
  tenantId: string;
  role: string;
  jti?: string;
}
