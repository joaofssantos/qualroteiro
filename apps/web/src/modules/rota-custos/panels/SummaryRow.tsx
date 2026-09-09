import { Clock, Droplets, Route as RouteIcon, TicketCheck } from 'lucide-react';
import type { ComponentType } from 'react';

import type { PlannedRoute } from '@/core/api/types';
import { formatCurrency, formatDuration, formatKm } from '@/lib/format';

/**
 * The four numbers that answer the question the user came with.
 *
 * Carries `data-testid="route-summary"` so a test can assert "the summary
 * changed" without matching the same figures where they also appear in the
 * alternatives list.
 */
function Stat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 px-3 py-2.5">
      <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </span>
      <span
        className={`text-lg font-semibold tabular-nums ${accent ? 'text-accent-foreground' : 'text-primary'}`}
      >
        {value}
      </span>
    </div>
  );
}

export function SummaryRow({ route }: { route: PlannedRoute }) {
  return (
    <div
      data-testid="route-summary"
      className="grid grid-cols-2 divide-x divide-y divide-border rounded-lg border border-border bg-card [&>*:nth-child(-n+2)]:border-t-0"
    >
      <Stat icon={RouteIcon} label="Distância" value={formatKm(route.distanceKm)} />
      <Stat icon={Clock} label="Tempo" value={formatDuration(route.durationMin)} />
      <Stat icon={TicketCheck} label="Pedágios" value={formatCurrency(route.tolls.total)} />
      <Stat icon={Droplets} label="Combustível" value={formatCurrency(route.fuel.cost)} />
    </div>
  );
}
