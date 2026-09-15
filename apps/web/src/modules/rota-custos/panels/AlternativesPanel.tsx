import type { PlannedRoute } from '@/core/api/types';
import { formatCurrency, formatDuration, formatKm } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * The alternatives the provider returned, as a radio group.
 *
 * A radio group rather than a list of buttons because exactly one alternative is
 * active at a time and that is what "radio" means — the keyboard behaviour and the
 * screen-reader announcement come for free.
 */
export function AlternativesPanel({
  routes,
  activeIndex,
  onSelect,
}: {
  routes: readonly PlannedRoute[];
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  const cheapest = Math.min(...routes.map((r) => r.tolls.total + r.fuel.cost));
  const fastest = Math.min(...routes.map((r) => r.durationMin));

  return (
    <div role="radiogroup" aria-label="Alternativas de rota" className="flex flex-col gap-1.5">
      {routes.map((route, index) => {
        const total = route.tolls.total + route.fuel.cost;
        const active = index === activeIndex;
        return (
          <button
            key={index}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onSelect(index)}
            className={cn(
              'flex flex-col gap-1.5 rounded-md border px-3 py-2.5 text-left transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'border-primary bg-secondary shadow-sm'
                : 'border-border bg-card hover:bg-secondary/60',
            )}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-foreground">
                {index === 0 ? 'Rota principal' : `Alternativa ${index}`}
              </span>
              <span className="text-sm font-semibold tabular-nums text-primary">
                {formatCurrency(total)}
              </span>
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {formatKm(route.distanceKm)} · {formatDuration(route.durationMin)} · pedágio{' '}
              {formatCurrency(route.tolls.total)}
            </span>
            <span className="flex gap-1.5">
              {total === cheapest ? (
                <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-foreground">
                  mais barata
                </span>
              ) : null}
              {route.durationMin === fastest ? (
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                  mais rápida
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
