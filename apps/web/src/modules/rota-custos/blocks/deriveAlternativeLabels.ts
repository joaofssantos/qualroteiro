import type { AxleCategory, PlannedRoute } from '@/core/api/types';

/**
 * Plazas on the route whose fare is unknown for the selected axle category.
 *
 * Prefers the API's own `tolls.unavailablePlazaIds`; when the field is absent
 * (older API) it falls back to plazas lacking `tariffByAxleCategory[axle]`.
 */
export function unavailablePlazaIdsOf(route: PlannedRoute, axleCategory?: AxleCategory): string[] {
  const fromApi = route.tolls.unavailablePlazaIds;
  if (fromApi) return [...fromApi];
  if (!axleCategory) return [];
  return route.tolls.plazas
    .filter((plaza) => plaza.tariffByAxleCategory?.[axleCategory] === undefined)
    .map((plaza) => plaza.id);
}

/** First index of the smallest value among `candidates` (a tie keeps the first). */
function firstMinIndex(candidates: readonly number[], value: (index: number) => number): number {
  let best = -1;
  for (const index of candidates) {
    if (best === -1 || value(index) < value(best)) best = index;
  }
  return best;
}

/**
 * Client-side labels for route alternatives (spec D7). Pure.
 *
 * - one route → `['Rota recomendada']`;
 * - fastest → "Mais rápida"; cheapest total → "Mais barata"; no toll → "Sem pedágio";
 *   the rest → "Alternativa N" (N = position, 1-based);
 * - ties go to the first route; one route never gets two labels (priority:
 *   rápida, barata, sem pedágio);
 * - a route with an unavailable fare is never "Mais barata" nor "Sem pedágio":
 *   its total is partial, so the comparison would be dishonest.
 */
export function deriveAlternativeLabels(
  routes: readonly PlannedRoute[],
  axleCategory?: AxleCategory,
): readonly string[] {
  if (routes.length === 0) return [];
  if (routes.length === 1) return ['Rota recomendada'];

  const all = routes.map((_, index) => index);
  const complete = all.filter((i) => unavailablePlazaIdsOf(routes[i]!, axleCategory).length === 0);
  const total = (i: number) => routes[i]!.tolls.total + routes[i]!.fuel.cost;

  const labels: (string | null)[] = routes.map(() => null);
  const assign = (index: number, label: string) => {
    if (index !== -1 && labels[index] === null) labels[index] = label;
  };

  assign(firstMinIndex(all, (i) => routes[i]!.durationMin), 'Mais rápida');
  assign(firstMinIndex(complete, total), 'Mais barata');
  assign(
    complete.find((i) => routes[i]!.tolls.plazas.length === 0 && routes[i]!.tolls.total === 0) ??
      -1,
    'Sem pedágio',
  );

  return labels.map((label, index) => label ?? `Alternativa ${index + 1}`);
}
