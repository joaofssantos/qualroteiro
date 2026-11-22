import { Chip } from '@/components/ui/chip';
import { formatCurrency, formatDuration, formatKm, formatLiters } from '@/lib/format';

/**
 * The one number the user came for: fuel + tolls.
 *
 * When some plaza has no published fare the total is *partial* (the API's
 * `tolls.total` leaves those plazas out), so the hero says so instead of
 * presenting a definitive figure.
 */
export function TotalHero({
  total,
  fuel,
  toll,
  unavailablePlazaIds,
  km,
  minutes,
  liters,
}: {
  /** Overrides the default `fuel + toll`; normally omitted. */
  total?: number;
  fuel: number;
  toll: number;
  unavailablePlazaIds: readonly string[];
  km: number;
  minutes: number;
  liters: number;
}) {
  const sum = total ?? fuel + toll;
  const missing = unavailablePlazaIds.length;
  return (
    <div
      data-testid="total-hero"
      className="flex flex-col gap-1 rounded-lg border border-border bg-card px-4 py-3"
    >
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {missing > 0 ? 'Custo total parcial' : 'Custo total'}
      </span>
      <span className="text-3xl font-bold tabular-nums text-primary">{formatCurrency(sum)}</span>
      {missing > 0 ? (
        <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Chip tone="warning">
            Tarifa indisponível em {missing} {missing === 1 ? 'praça' : 'praças'}
          </Chip>
          <span>Total parcial: esses pedágios não entram na soma.</span>
        </span>
      ) : null}
      <span className="flex flex-wrap gap-x-3 text-xs tabular-nums text-muted-foreground">
        <span>{formatKm(km)}</span>
        <span>{formatDuration(minutes)}</span>
        <span>{formatLiters(liters)}</span>
      </span>
    </div>
  );
}
