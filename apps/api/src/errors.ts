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
