import type { AxleCategory, PlannedRoute } from '@/core/api/types';

import { CostBar } from '../blocks/CostBar';
import { TotalHero } from '../blocks/TotalHero';
import { unavailablePlazaIdsOf } from '../blocks/deriveAlternativeLabels';

/**
 * The numbers that answer the question the user came with: the total (hero) and
 * how it splits between fuel and tolls.
 *
 * Carries `data-testid="route-summary"` so a test can assert "the summary
 * changed" without matching the same figures where they also appear in the
 * alternatives list.
 */
export function SummaryRow({
  route,
  axleCategory,
}: {
  route: PlannedRoute;
  axleCategory?: AxleCategory;
}) {
  return (
    <div data-testid="route-summary" className="flex flex-col gap-3">
      <TotalHero
        fuel={route.fuel.cost}
        toll={route.tolls.total}
        unavailablePlazaIds={unavailablePlazaIdsOf(route, axleCategory)}
        km={route.distanceKm}
        minutes={route.durationMin}
        liters={route.fuel.liters}
      />
      <CostBar fuel={route.fuel.cost} toll={route.tolls.total} />
    </div>
  );
}
