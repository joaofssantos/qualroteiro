import { ChevronRight } from 'lucide-react';

import { EmptyState } from '@/components/ui/card';
import type { AxleCategory, PlannedRoute, TollPlaza } from '@/core/api/types';
import { formatCurrency, formatKmMarker } from '@/lib/format';

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
        description="A base de pedágios desta fase cobre três corredores do Sudeste; trechos fora deles aparecem sem cobrança."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul aria-label="Praças de pedágio" className="flex flex-col gap-1.5">
        {route.tolls.plazas.map((plaza) => (
          <li key={plaza.id}>
            <button
              type="button"
              onClick={() => onSelectPlaza(plaza)}
              className="flex w-full items-center gap-3 rounded-md border border-border bg-card px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {plaza.name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {plaza.concessionaire} · {plaza.highway} · {formatKmMarker(plaza.km)}
                </span>
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-primary">
                {formatCurrency(plaza.tariffByAxleCategory[axleCategory])}
              </span>
              <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between rounded-md bg-secondary px-3 py-2.5">
        <span className="text-sm font-medium text-secondary-foreground">Total de pedágios</span>
        <span className="text-base font-bold tabular-nums text-primary">
          {formatCurrency(route.tolls.total)}
        </span>
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Tarifas de referência (2024–2025) da base de demonstração desta fase. Confirme no
        guichê antes de viajar.
      </p>
    </div>
  );
}
