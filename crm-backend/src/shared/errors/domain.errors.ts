/**
 * Domain Error Classes
 *
 * Framework-agnostic typed errors thrown by business logic (services, repositories).
 * NO NestJS imports — these are pure TypeScript classes.
 *
 * The AllExceptionsFilter maps these to the correct HTTP status codes,
 * keeping all HTTP concern out of the domain layer.
 *
 * Usage:
 *   throw new NotFoundError('Lead', id);
 *   throw new ConflictError('Email already in use');
 *   throw new BusinessRuleError('Cannot delete the default pipeline');
 */

/** Base class for all domain errors — never throw this directly */
export abstract class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = this.constructor.name;
    // Maintains proper prototype chain in transpiled ES5
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Resource not found in the database */
export class NotFoundError extends DomainError {
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} ${id} not found` : `${resource} not found`,
      'NOT_FOUND',
    );
  }
}

/** Unique constraint or business-level uniqueness violation */
export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message, 'CONFLICT');
  }
}

/** Input data fails business validation (beyond schema validation) */
export class ValidationError extends DomainError {
  constructor(
    message: string,
    public readonly errors?: Record<string, string[]>,
  ) {
    super(message, 'VALIDATION_ERROR');
  }
}

/** Caller is authenticated but lacks permission for this action */
export class ForbiddenError extends DomainError {
  constructor(message: string = 'You do not have permission to perform this action') {
    super(message, 'FORBIDDEN');
  }
}

/** Caller is not authenticated or token is invalid/expired */
export class UnauthorizedError extends DomainError {
  constructor(message: string = 'Authentication required') {
    super(message, 'UNAUTHORIZED');
  }
}

/**
 * A business rule has been violated.
 * Use this for domain-specific constraints that go beyond simple validation:
 * - "Cannot delete the default pipeline"
 * - "Cannot retry a successful delivery"
 * - "Cannot invite a user who is already a member"
 */
export class BusinessRuleError extends DomainError {
  constructor(message: string) {
    super(message, 'BUSINESS_RULE_VIOLATION');
  }
}

/** External service or integration failed */
export class ExternalServiceError extends DomainError {
  constructor(
    service: string,
    public readonly cause?: Error,
  ) {
    super(`External service error: ${service}`, 'EXTERNAL_SERVICE_ERROR');
  }
}
