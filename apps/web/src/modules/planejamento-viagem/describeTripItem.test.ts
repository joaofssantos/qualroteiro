import { describe, expect, it } from 'vitest';

import type { TripItem } from '@/core/api/trips';
import { formatDuration, formatKm } from '@/lib/format';
import { DUTRA_ROUTE, PLAN_QUERY_FIXTURE } from '@/test/fixtures';

import { describeTripItem } from './describeTripItem';

const TITLE = 'São Paulo → Rio de Janeiro';

function rotaCustosItem(payload: unknown): TripItem {
  return {
    id: 'item-1',
    tripDayId: 'day-1',
    order: 0,
    moduleId: 'rota-custos',
    kind: 'route',
    title: TITLE,
    payload,
    costEstimate: DUTRA_ROUTE.tolls.total + DUTRA_ROUTE.fuel.cost,
  };
}

describe('describeTripItem — rota-custos regression (j-20260917-up Wave 2)', () => {
  it('describes an item saved with the OLD payload shape (PlannedRoute only, no query)', () => {
    // Exactly what `SaveRouteToTripDialog` used to save before this wave: the
    // `PlannedRoute` fields spread at the root, no `query` key at all.
    const oldPayload = { ...DUTRA_ROUTE };
    expect('query' in oldPayload).toBe(false);

    const description = describeTripItem(rotaCustosItem(oldPayload));

    expect(description).toBe(
      `${TITLE} · ${formatKm(DUTRA_ROUTE.distanceKm)} · ${formatDuration(DUTRA_ROUTE.durationMin)}`,
    );
  });

  it('describes an item saved with the NEW payload shape (PlannedRoute + query) the same way', () => {
    const newPayload = { ...DUTRA_ROUTE, query: PLAN_QUERY_FIXTURE };

    const description = describeTripItem(rotaCustosItem(newPayload));

    expect(description).toBe(
      `${TITLE} · ${formatKm(DUTRA_ROUTE.distanceKm)} · ${formatDuration(DUTRA_ROUTE.durationMin)}`,
    );
  });
});
