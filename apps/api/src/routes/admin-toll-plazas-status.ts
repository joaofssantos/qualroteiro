/**
 * `GET /admin/toll-plazas-status` — read the persisted toll plaza table's
 * aggregate status (T5 Wave 2, `j-20260916-9y`).
 *
 * Deliberately UNAUTHENTICATED, same precedent as G1's
 * `GET /admin/places-usage` (`admin-places-usage.ts`): this is operational
 * data (how much has been ingested, how recently), not user data. An empty
 * table (before Wave 3's ingestion job has ever run) is a normal state, not
 * an error — it answers `{ count: 0, lastIngestedAt: null }`, 200.
 */

import type { FastifyInstance } from 'fastify';

import type { TollPlazaStore } from '../store/toll-plaza-store.js';

export interface AdminTollPlazasStatusRouteDeps {
  readonly tollPlazas: TollPlazaStore;
}

export function registerAdminTollPlazasStatusRoute(
  app: FastifyInstance,
  deps: AdminTollPlazasStatusRouteDeps,
): void {
  app.get('/admin/toll-plazas-status', async () => {
    const status = await deps.tollPlazas.status();

    return {
      count: status.count,
      lastIngestedAt: status.lastIngestedAt === null ? null : status.lastIngestedAt.toISOString(),
    };
  });
}
