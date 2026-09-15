/**
 * The error taxonomy the HTTP layer maps to status codes.
 *
 * Anything NOT in this file that escapes a handler is a genuine bug and becomes
 * a 500 — that distinction is the point of having named errors at all.
 */

/** A malformed request the client can fix by correcting the payload → `400`. */
export class ValidationError extends Error {
  /** The offending field's path, e.g. `destination`, `vehicle.axleCategory`. */
  readonly field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

/**
 * A well-formed place string that the geocoder returned no hit for → `422`.
 *
 * Distinct from {@link ValidationError}: the client sent a valid field, the
 * world just has no answer for it. Correcting the payload shape would not help.
 */
export class UnresolvedPlaceError extends Error {
  readonly field: string;
  readonly query: string;

  constructor(field: string, query: string) {
    super(`${field}: no place found for '${query}'`);
    this.name = 'UnresolvedPlaceError';
    this.field = field;
    this.query = query;
  }
}

/**
 * The request carried no usable credential, or one Clerk rejected → `401`.
 *
 * The message reaches the client verbatim, so it must never quote the token or
 * anything derived from it — see `src/auth/clerk.ts`, which deliberately drops
 * Clerk's own error text for that reason.
 */
export class UnauthorizedError extends Error {
  constructor(message = 'authentication required') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * The addressed resource does not exist, **or** exists and belongs to somebody
 * else → `404`.
 *
 * Those two cases are deliberately indistinguishable: `F2-COORDINATION.md` §3
 * requires that a non-owner learn nothing about a trip's existence. The store
 * enforces it structurally (every read is scoped by `userId`, so a non-owner's
 * query simply finds nothing) and the handlers pass the same message for both,
 * which is why this error carries no resource id.
 */
export class NotFoundError extends Error {
  constructor(message = 'not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

/**
 * An upstream provider failed, errored, returned an unusable payload, or timed
 * out → `502`.
 */
export class ProviderError extends Error {
  /** Which provider, for logs: `'routing'` | `'geocode'`. */
  readonly provider: string;

  constructor(provider: string, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ProviderError';
    this.provider = provider;
  }
}
