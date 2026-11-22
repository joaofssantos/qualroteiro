import { ChevronRight } from 'lucide-react';

import type { AxleCategory, TollPlaza } from '@/core/api/types';
import { formatCurrency, formatKmMarker } from '@/lib/format';

/**
 * One plaza. The visible number is `index + 1` — the same number the map pin
 * carries (`MapMarkerSpec.index`), so list and map can be read together.
 */
export function TollRow({
  index,
  plaza,
  axleCategory,
  unavailable,
  onSelect,
}: {
  index: number;
  plaza: TollPlaza;
  axleCategory: AxleCategory;
  unavailable: boolean;
  onSelect: (plaza: TollPlaza) => void;
}) {
  const tariff = plaza.tariffByAxleCategory?.[axleCategory];
  const hasFare = !unavailable && tariff !== undefined;
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(plaza)}
        className="flex min-h-[44px] w-full items-center gap-3 rounded-md border border-border bg-card px-3 py-2.5 text-left transition-colors motion-reduce:transition-none hover:border-primary/40 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span
          aria-hidden
          className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
        >
          {index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">{plaza.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {plaza.concessionaire} · {plaza.highway} · {formatKmMarker(plaza.km)}
          </span>
        </span>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-primary">
          {hasFare ? formatCurrency(tariff) : 'Valor não disponível'}
        </span>
        <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      </button>
    </li>
  );
}
