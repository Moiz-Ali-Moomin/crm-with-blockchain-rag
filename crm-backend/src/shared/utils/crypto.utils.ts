/**
 * Crypto Utilities
 *
 * Pure cryptographic helpers used across the application.
 * No NestJS imports — wraps Node's built-in `crypto` module only.
 *
 * Used by:
 *  - WebhooksService: HMAC-signs outbound payloads
 *  - AuthService: generates secure random tokens for password reset
 *  - Any module that needs secure random strings or payload signatures
 */

import * as crypto from 'crypto';

/**
 * Generates a cryptographically secure random hex string.
 *
 * @param bytes - Number of random bytes (output is 2× this length in hex)
 * @default 32 bytes → 64-char hex string
 */
export function randomToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Generates a URL-safe base64 random string (no +, /, or = padding).
 */
export function randomBase64Token(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

/**
 * Creates an HMAC-SHA256 signature for a payload.
 * Used to sign outbound webhook deliveries so receivers can verify authenticity.
 *
 * @example
 * const sig = hmacSha256(secret, JSON.stringify(payload));
 * // Header: X-Webhook-Signature: sha256=<sig>
 */
export function hmacSha256(secret: string, payload: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Constant-time comparison to prevent timing attacks when verifying signatures.
 *
 * @example
 * const expected = hmacSha256(secret, body);
 * if (!timingSafeEqual(expected, receivedSignature)) throw new Error('Bad signature');
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Hashes a value with SHA-256. Used for non-password deterministic hashes
 * (e.g., deduplication keys, idempotency keys).
 */
export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}
