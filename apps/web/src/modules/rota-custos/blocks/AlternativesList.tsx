import type { AxleCategory, PlannedRoute } from '@/core/api/types';

import { AltCard } from './AltCard';
import { deriveAlternativeLabels } from './deriveAlternativeLabels';

/** The alternatives as a radio group, labelled by `deriveAlternativeLabels`. */
export function AlternativesList({
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
  const labels = deriveAlternativeLabels(routes, axleCategory);
  return (
    <div role="radiogroup" aria-label="Alternativas de rota" className="flex flex-col gap-1.5">
      {routes.map((route, index) => (
        <AltCard
          key={index}
          route={route}
          label={labels[index] ?? `Alternativa ${index + 1}`}
          selected={index === activeIndex}
          onSelect={() => onSelect(index)}
        />
      ))}
    </div>
  );
}
