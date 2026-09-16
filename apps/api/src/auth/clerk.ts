/**
 * The Clerk adapter for {@link AuthVerifier} — the only module in `apps/api`
 * that imports the Clerk SDK.
 *
 * Constructed exclusively by `src/server.ts` from `CLERK_SECRET_KEY`. No test
 * imports this file, which is deliberate: it is what keeps the real secret out
 * of every fixture, and so out of the repository.
 */

import { verifyToken } from '@clerk/backend';

import { UnauthorizedError } from '../errors.js';
import type { AuthVerifier, VerifiedUser } from './verifier.js';

export interface ClerkAuthOptions {
  /** `CLERK_SECRET_KEY`. Never logged, never included in an error message. */
  readonly secretKey: string;
}

/**
 * Verify Clerk session tokens.
 *
 * `verifyToken` checks the JWT's signature against Clerk's JWKS (cached by the
 * SDK), its expiry, and its issuer. The `sub` claim is the Clerk user id — the
 * exact value `F2-COORDINATION.md` §3 stores in `Trip.userId`.
 */
export function createClerkAuthVerifier(options: ClerkAuthOptions): AuthVerifier {
  return {
    async verifyBearerToken(token: string): Promise<VerifiedUser> {
      let claims: Awaited<ReturnType<typeof verifyToken>>;

      try {
        claims = await verifyToken(token, { secretKey: options.secretKey });
      } catch {
        // Clerk's own error text is dropped on purpose rather than forwarded.
        // It is written for a server log, can quote the offending token, and
        // this message goes straight to the client as `{ "error": ... }`.
        // Everything useful for debugging a genuine outage would be in the
        // request log anyway; everything useful to an attacker is in here.
        throw new UnauthorizedError('invalid or expired session token');
      }

      const userId = claims.sub;

      // A signature-valid token with no subject is not a user. Refusing beats
      // storing `undefined` as an owner id, which would make one row visible
      // to every other subject-less token.
      if (typeof userId !== 'string' || userId.trim().length === 0) {
        throw new UnauthorizedError('session token carries no subject');
      }

      return { userId: userId.trim() };
    },
  };
}
