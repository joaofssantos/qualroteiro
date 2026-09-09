/**
 * Render the real application — real shell, real registry, real router, real
 * store — with only the network faked.
 *
 * Tests that drive the module go through this rather than mounting a screen in
 * isolation, because the things the acceptance criteria care about (submitting
 * navigates to the result; picking an alternative changes the map) are exactly
 * the seams that a component-in-isolation test cannot see.
 */

import { type RenderResult, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import { AppRouter } from '@/core/shell/AppRouter';
import { resetRegistry } from '@/core/registry/registry';
import { useRouteStore } from '@/core/store/routeStore';
import type { PlannedRoute } from '@/core/api/types';
import type { Place } from '@/core/api/types';
import { registerAppModules } from '@/modules';

export interface ApiMock {
  /** Hits returned by `GET /places/search`. */
  places?: readonly Place[];
  /** Alternatives returned by `POST /routes/plan`. */
  routes?: readonly PlannedRoute[];
  /** Override the plan response entirely — used for the error-path tests. */
  planResponse?: () => Response;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Install a `fetch` double that routes by URL, and hand back the spy. */
export function mockApi(mock: ApiMock = {}) {
  // `init` is part of the signature so tests can assert on the request body.
  const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    void init;
    const url = typeof input === 'string' ? input : input.toString();

    if (url.startsWith('/api/places/search')) {
      return jsonResponse({ places: mock.places ?? [] });
    }
    if (url.startsWith('/api/routes/plan')) {
      return mock.planResponse ? mock.planResponse() : jsonResponse({ routes: mock.routes ?? [] });
    }
    throw new Error(`unexpected request in test: ${url}`);
  });

  vi.stubGlobal('fetch', spy);
  return spy;
}

/** Put the app back to a clean slate between cases. */
export function resetApp(): void {
  resetRegistry();
  useRouteStore.setState({
    query: null,
    routes: [],
    activeIndex: 0,
    status: 'idle',
    error: null,
    layers: [],
  });
}

// The return type is annotated rather than inferred: the inferred type reaches
// into @testing-library/dom's internals, which pnpm's nested layout makes
// unnameable from here (TS2742).
export function renderApp(initialPath = '/rota-custos'): RenderResult {
  registerAppModules();
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AppRouter />
    </MemoryRouter>,
  );
}
