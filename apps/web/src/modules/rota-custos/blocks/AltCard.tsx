import type { PlannedRoute } from '@/core/api/types';
import { formatCurrency, formatDuration, formatKm } from '@/lib/format';
import { cn } from '@/lib/utils';

/** One alternative, as a radio (exactly one is active at a time). */
export function AltCard({
  route,
  label,
  selected,
  onSelect,
}: {
  route: PlannedRoute;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const total = route.tolls.total + route.fuel.cost;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'flex min-h-[44px] flex-col gap-1.5 rounded-md border px-3 py-2.5 text-left transition-colors motion-reduce:transition-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected ? 'border-primary bg-secondary shadow-sm' : 'border-border bg-card hover:bg-secondary/60',
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-sm font-semibold tabular-nums text-primary">{formatCurrency(total)}</span>
      </span>
      <span className="text-xs tabular-nums text-muted-foreground">
        {formatKm(route.distanceKm)} · {formatDuration(route.durationMin)} · pedágio{' '}
        {formatCurrency(route.tolls.total)}
      </span>
    </button>
  );
}
