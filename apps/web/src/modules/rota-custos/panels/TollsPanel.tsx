import { EmptyState } from '@/components/ui/card';
import type { AxleCategory, PlannedRoute, TollPlaza } from '@/core/api/types';
import { formatCurrency } from '@/lib/format';

import { unavailablePlazaIdsOf } from '../blocks/deriveAlternativeLabels';
import { TollRow } from '../blocks/TollRow';

/**
 * Every plaza on the route, with the fare for the selected axle category.
 *
 * The tariff is read straight from the plaza's `tariffByAxleCategory` — the web
 * app never multiplies a base fare by an axle multiplier, because
 * `@qualroteiro/tolls` owns that ladder and two implementations of it would
 * eventually disagree.
 */
export function TollsPanel({
  route,
  axleCategory,
  onSelectPlaza,
}: {
  route: PlannedRoute;
  axleCategory: AxleCategory;
  onSelectPlaza: (plaza: TollPlaza) => void;
}) {
  if (route.tolls.plazas.length === 0) {
    return (
      <EmptyState
        title="Nenhuma praça de pedágio nesta rota"
        description="A cobertura usa dados federais da ANTT. Uma praça sem tarifa cadastrada não significa que o trecho não tenha cobrança."
      />
    );
  }

  const unavailable = new Set(unavailablePlazaIdsOf(route, axleCategory));

  return (
    <div className="flex flex-col gap-3">
      <ul aria-label="Praças de pedágio" className="flex flex-col gap-1.5">
        {route.tolls.plazas.map((plaza, index) => (
          <TollRow
            key={plaza.id}
            index={index}
            plaza={plaza}
            axleCategory={axleCategory}
            unavailable={unavailable.has(plaza.id)}
            onSelect={onSelectPlaza}
          />
        ))}
      </ul>

      <div className="flex items-center justify-between rounded-md bg-secondary px-3 py-2.5">
        <span className="text-sm font-medium text-secondary-foreground">
          {unavailable.size > 0 ? 'Total de pedágios (parcial)' : 'Total de pedágios'}
        </span>
        <span className="text-base font-bold tabular-nums text-primary">
          {formatCurrency(route.tolls.total)}
        </span>
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Localização das praças informada pela ANTT. As tarifas ainda podem estar indisponíveis
        para algumas praças; confirme antes de viajar.
      </p>
    </div>
  );
}
