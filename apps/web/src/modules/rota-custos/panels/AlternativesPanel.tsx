import type { AxleCategory, PlannedRoute } from '@/core/api/types';

import { AlternativesList } from '../blocks/AlternativesList';

/** The alternatives the provider returned, labelled client-side (spec D7). */
export function AlternativesPanel({
  routes,
  activeIndex,
  axleCategory,
  onSelect,
}: {
  routes: readonly PlannedRoute[];
  activeIndex: number;
  axleCategory?: AxleCategory;
  onSelect: (index: number) => void;
}) {
  return (
    <AlternativesList
      routes={routes}
      activeIndex={activeIndex}
      axleCategory={axleCategory}
      onSelect={onSelect}
    />
  );
}
