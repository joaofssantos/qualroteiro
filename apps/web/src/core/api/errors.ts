/**
 * The client-side error taxonomy, mirroring the API's status codes.
 *
 * The distinction the UI actually depends on is `400` vs `422`: a `400` means the
 * payload is wrong and the user should fix the form; a `422` means the payload was
 * fine and the *world* has no answer — the address could not be geocoded. Showing
 * "corrija o formulário" for a `422` would send the user hunting for a mistake
 * that isn't there, so the two never collapse into one "request failed".
 */

/** Which field an error belongs to, in the API's own naming. */
export type ErrorField = 'origin' | 'destination' | (string & {});

export type ApiErrorKind =
  /** `400` — a field is missing, ill-typed or out of range. */
  | 'validation'
  /** `422` — a place string geocoded to nothing. */
  | 'unresolved-place'
  /** `502` — an upstream provider failed or timed out. */
  | 'provider'
  /** The request never completed: offline, DNS, CORS, abort. */
  | 'network'
  /** Anything else, including a `500`. */
  | 'unknown';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  /** HTTP status, or `0` when the request never reached the server. */
  readonly status: number;
  /**
   * The field the error is about, when one can be determined.
   *
   * `origin`, `destination` or `waypoints[i]`. See {@link fieldFromMessage} for
   * why this is parsed rather than read from a structured body.
   */
  readonly field?: ErrorField;

  constructor(kind: ApiErrorKind, status: number, message: string, field?: ErrorField) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    if (field !== undefined) this.field = field;
  }

  /** True when this error should be pinned to a specific form field. */
  get isFieldError(): boolean {
    return this.field !== undefined;
  }
}

/**
 * Recover the offending field from an API error message.
 *
 * The contract's error body is `{ error: string }` with no structured field, and
 * `UnresolvedPlaceError` on the server formats its message as
 * `` `${field}: no place found for '${query}'` ``. So the field is the text before
 * the first colon, when that text looks like one of the request's place fields.
 *
 * This is deliberately conservative: an unrecognised prefix yields `undefined` and
 * the UI falls back to a form-level message, rather than pinning an error to a
 * field it invented. If the API later adds a structured `field` to the body, the
 * client should prefer it and this parser becomes the fallback.
 */
const PLACE_FIELD = /^(origin|destination|waypoints\[\d+\])\s*:/;

export function fieldFromMessage(message: string): ErrorField | undefined {
  return PLACE_FIELD.exec(message)?.[1];
}

/** Map an HTTP status onto the taxonomy. */
export function kindFromStatus(status: number): ApiErrorKind {
  if (status === 400) return 'validation';
  if (status === 422) return 'unresolved-place';
  if (status === 502) return 'provider';
  return 'unknown';
}

/**
 * A message a Brazilian user can act on.
 *
 * The API's messages are developer-facing English; they name the field, which is
 * useful, but "no place found for 'x'" is not what belongs on a form.
 */
export function userMessage(error: ApiError): string {
  switch (error.kind) {
    case 'unresolved-place':
      return 'Endereço não encontrado. Tente ser mais específico — inclua cidade e estado.';
    case 'validation':
      return 'Confira os campos destacados e tente novamente.';
    case 'provider':
      return 'O serviço de rotas está indisponível no momento. Tente novamente em instantes.';
    case 'network':
      return 'Não foi possível conectar. Verifique sua conexão e tente novamente.';
    default:
      return 'Algo deu errado ao calcular a rota. Tente novamente.';
  }
}
