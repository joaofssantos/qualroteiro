/**
 * `GET /admin/places-usage` — read the persisted circuit-breaker counters.
 *
 * Deliberately UNAUTHENTICATED in this unit: this is operational data (how
 * close the breaker is to tripping this month), not user data, and G1 does
 * not add an admin auth boundary. An explicit scope decision — see
 * `specs/006-g1-google-places/spec.md` "Out of scope".
 */

import type { FastifyInstance } from 'fastify';

import type { ApiUsageStore } from '../store/api-usage.js';

export interface AdminPlacesUsageRouteDeps {
  readonly usage: ApiUsageStore;
  /** SKU → configured monthly cap, so a caller can see how close it is. */
  readonly caps: Readonly<Record<string, number>>;
}

export function registerAdminPlacesUsageRoute(
  app: FastifyInstance,
  deps: AdminPlacesUsageRouteDeps,
): void {
  app.get('/admin/places-usage', async () => {
    const rows = await deps.usage.listAll();

    return {
      usage: rows.map((row) => ({
        sku: row.sku,
        yearMonth: row.yearMonth,
        count: row.count,
        cap: deps.caps[row.sku] ?? null,
      })),
    };
  });
}
