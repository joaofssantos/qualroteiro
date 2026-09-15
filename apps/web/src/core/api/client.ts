/**
 * The one place this app talks to the network.
 *
 * Every component reaches the API through these two functions, which is what lets
 * a test mock `fetch` and exercise real components rather than stubbing a
 * component's internals.
 */

import { isDemoMode } from './demo/mode';
import { ApiError, fieldFromMessage, kindFromStatus } from './errors';
import type {
  ApiErrorBody,
  Place,
  PlanRouteRequest,
  PlanRouteResponse,
  PlannedRoute,
  SearchPlacesResponse,
} from './types';

export { ApiError } from './errors';
export type { ApiErrorKind, ErrorField } from './errors';
export { userMessage } from './errors';

/**
 * Where the API lives.
 *
 * Defaults to the relative `/api`, which the Vite dev server proxies to the API
 * origin (see `vite.config.ts`). Keeping it relative in development means requests
 * are same-origin, so no CORS preflight is in play and a misconfigured proxy fails
 * loudly as a 404 rather than quietly as an opaque CORS error.
 */
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

function url(path: string): string {
  return `${BASE_URL.replace(/\/$/, '')}${path}`;
}

/** Read `{ error }` off a failed response, tolerating a non-JSON body. */
async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as Partial<ApiErrorBody>;
    if (typeof body.error === 'string' && body.error.length > 0) return body.error;
  } catch {
    // A proxy or gateway can answer with HTML; fall through to the status text.
  }
  return response.statusText || `HTTP ${response.status}`;
}

async function toApiError(response: Response): Promise<ApiError> {
  const message = await errorMessage(response);
  const kind = kindFromStatus(response.status);
  // Only a 422 is field-attributable: a 400 names a field too, but its field may
  // be a nested vehicle property the form maps differently, so the UI treats a
  // 400 through its own validation path.
  const field = kind === 'unresolved-place' ? fieldFromMessage(message) : undefined;
  return new ApiError(kind, response.status, message, field);
}

/**
 * Wrap a transport failure.
 *
 * `fetch` rejects — rather than resolving with a status — when the request never
 * completed at all: offline, DNS failure, CORS rejection, or an abort. An abort is
 * re-thrown untouched so a caller that superseded its own request can recognise it
 * and stay silent instead of flashing an error at the user.
 */
function toNetworkError(cause: unknown): never {
  if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
  throw new ApiError('network', 0, cause instanceof Error ? cause.message : 'network error');
}

/**
 * `POST /routes/plan` — the F1 composition endpoint.
 *
 * When `VITE_DEMO_MODE` is on, the request is served from `./demo` fixtures — a
 * real `Response` that flows through the identical `!response.ok`/`.json()`
 * handling below, so no calling code changes. The demo module is `import()`ed
 * lazily so it stays out of a default production bundle.
 */
export async function planRoute(
  request: PlanRouteRequest,
  signal?: AbortSignal,
): Promise<readonly PlannedRoute[]> {
  let response: Response;
  try {
    if (isDemoMode()) {
      const { demoPlanRoute } = await import('./demo');
      response = await demoPlanRoute(request, signal);
    } else {
      response = await fetch(url('/routes/plan'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
        ...(signal ? { signal } : {}),
      });
    }
  } catch (cause) {
    toNetworkError(cause);
  }

  if (!response.ok) throw await toApiError(response);

  const body = (await response.json()) as PlanRouteResponse;
  return body.routes ?? [];
}

/**
 * `GET /places/search?q=` — forward geocoding.
 *
 * Takes a signal because the caller (`PlaceSearch`) supersedes its own in-flight
 * request on every keystroke past the debounce window.
 */
export async function searchPlaces(q: string, signal?: AbortSignal): Promise<readonly Place[]> {
  let response: Response;
  try {
    if (isDemoMode()) {
      const { demoSearchPlaces } = await import('./demo');
      response = await demoSearchPlaces(q, signal);
    } else {
      response = await fetch(url(`/places/search?q=${encodeURIComponent(q)}`), {
        ...(signal ? { signal } : {}),
      });
    }
  } catch (cause) {
    toNetworkError(cause);
  }

  if (!response.ok) throw await toApiError(response);

  const body = (await response.json()) as SearchPlacesResponse;
  return body.places ?? [];
}
