/**
 * Stand-ins for the two `apps/api` endpoints the app uses, for when
 * `VITE_DEMO_MODE` is on and there is no backend.
 *
 * Each returns a real `Response` — JSON body, HTTP status, `content-type` — so
 * `client.ts` runs it through the very same `!response.ok → toApiError` and
 * `response.json()` path it uses for the network. The error taxonomy the UI
 * depends on (`400` validation vs `422` unresolved-place vs `502` provider) is
 * therefore identical to the live path by construction, not by re-implementation.
 *
 * Contract mirrored: `apps/api/specs/002-rota-custos-api/spec.md`.
 */

import type { PlaceInput, PlanRouteRequest, PlanRouteResponse } from '../types';
import {
  buildPlannedRoute,
  findDemoCorridor,
  resolveDemoCity,
  searchDemoCities,
} from './fixtures';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * Resolve like a network call: yield a microtask, then honour an abort signal
 * with the same `AbortError` a real `fetch` raises (so a superseded
 * `PlaceSearch` request is recognised and silently dropped, not shown as an
 * error).
 */
async function resolveLikeNetwork(
  signal: AbortSignal | undefined,
  build: () => Response,
): Promise<Response> {
  await Promise.resolve();
  if (signal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError');
  }
  return build();
}

function describeInput(input: PlaceInput): string {
  return typeof input === 'string' ? `'${input}'` : `(${input.lng}, ${input.lat})`;
}

/** `GET /places/search?q=` — fixture `Place[]`, `400` on a blank query. */
export function demoSearchPlaces(q: string, signal?: AbortSignal): Promise<Response> {
  return resolveLikeNetwork(signal, () => {
    if (q.trim() === '') {
      return jsonResponse({ error: "q: informe um termo de busca ('q') não vazio." }, 400);
    }
    return jsonResponse({ places: searchDemoCities(q) });
  });
}

/** `POST /routes/plan` — one `PlannedRoute` for a seeded corridor, else `422`. */
export function demoPlanRoute(
  request: PlanRouteRequest,
  signal?: AbortSignal,
): Promise<Response> {
  return resolveLikeNetwork(signal, () => {
    const origin = resolveDemoCity(request.origin);
    if (origin === null) {
      return jsonResponse(
        {
          error: `origin: nenhum lugar do modo demonstração corresponde a ${describeInput(
            request.origin,
          )}.`,
        },
        422,
      );
    }

    const destination = resolveDemoCity(request.destination);
    if (destination === null) {
      return jsonResponse(
        {
          error: `destination: nenhum lugar do modo demonstração corresponde a ${describeInput(
            request.destination,
          )}.`,
        },
        422,
      );
    }

    const corridor = findDemoCorridor(origin.place.id, destination.place.id);
    if (corridor === null) {
      // Both endpoints are known cities but no seeded corridor connects them.
      // The message is prefixed `destination:` so the client attributes it to
      // the destination field and reuses the "endereço não encontrado" UX —
      // a demo-grade approximation, documented in specs/004-web-demo-mode.
      return jsonResponse(
        {
          error: `destination: não há corredor de demonstração entre '${origin.place.label}' e '${destination.place.label}'.`,
        },
        422,
      );
    }

    const route = buildPlannedRoute(corridor.spec, corridor.reversed, request);
    return jsonResponse({ routes: [route] } satisfies PlanRouteResponse);
  });
}
