/**
 * The auth port.
 *
 * Handlers never import Clerk. They depend on {@link AuthVerifier}, exactly as
 * the F1 handlers depend on `RoutingProvider`/`GeocodeProvider`
 * (specs/005-f2a-trips/plan.md D-506). `src/server.ts` is the only module that
 * constructs the Clerk-backed implementation; tests inject a fake and the
 * production `/trips*` handlers run unmodified with no network call and no
 * Clerk secret in sight.
 */

import type { FastifyRequest } from 'fastify';

import { UnauthorizedError } from '../errors.js';

/** What verification yields: the Clerk user id, and nothing else we need. */
export interface VerifiedUser {
  readonly userId: string;
}

export interface AuthVerifier {
  /**
   * Verify a bearer token.
   *
   * @throws {UnauthorizedError} if the token is absent, malformed, expired or
   * otherwise not trustworthy. Implementations must not put the token into the
   * error message — it reaches the client.
   */
  verifyBearerToken(token: string): Promise<VerifiedUser>;
}

declare module 'fastify' {
  interface FastifyRequest {
    /**
     * The verified Clerk user id, set by the `/trips*` scope's `preHandler`.
     *
     * `null` everywhere else — F1's routes are anonymous and never run that
     * hook. Read it through {@link requireUserId} rather than directly, so a
     * handler cannot silently proceed with no user.
     */
    authUserId: string | null;
  }
}

const BEARER_PATTERN = /^Bearer[ \t]+(.+)$/i;

/**
 * Pull the token out of an `Authorization` header.
 *
 * @throws {UnauthorizedError} when the header is absent or is not a non-empty
 * `Bearer <token>`. The thrown message names the problem but never echoes the
 * header, because a malformed header may still contain a real credential.
 */
export function extractBearerToken(header: string | undefined): string {
  if (header === undefined) {
    throw new UnauthorizedError('missing Authorization header');
  }

  const match = BEARER_PATTERN.exec(header.trim());
  const token = match?.[1]?.trim();

  if (token === undefined || token.length === 0) {
    throw new UnauthorizedError('Authorization header must be "Bearer <token>"');
  }

  return token;
}

/**
 * The verified user id for a request inside the authenticated scope.
 *
 * @throws {UnauthorizedError} if called outside it. Unreachable in practice —
 * the `preHandler` runs first and rejects — but it means a future route
 * registered in the wrong scope fails closed instead of reading `null` as a
 * user id and serving somebody else's trips.
 */
export function requireUserId(request: FastifyRequest): string {
  const userId = request.authUserId;

  if (userId === null || userId === undefined || userId.length === 0) {
    throw new UnauthorizedError('authentication required');
  }

  return userId;
}
