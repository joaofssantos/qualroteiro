import type { PlannedRoute } from '@/core/api/types';
import { formatCurrency, formatKm, formatLiters } from '@/lib/format';

/**
 * Fuel: how much, at what price, for how much.
 *
 * The three figures are shown together rather than just the total, because the
 * total is only as good as the consumption the user typed — showing the litres
 * and the price alongside makes an implausible number self-evidently so.
 */
export function FuelPanel({
  route,
  pricePerL,
  consumptionKmPerL,
}: {
  route: PlannedRoute;
  pricePerL: number;
  consumptionKmPerL: number;
}) {
  return (
    <div data-testid="fuel-panel" className="flex flex-col gap-3">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border">
        <div className="bg-card px-3 py-2.5">
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Consumo</dt>
          <dd className="text-sm font-medium tabular-nums text-foreground">
            {consumptionKmPerL} km/l
          </dd>
        </div>
        <div className="bg-card px-3 py-2.5">
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Distância</dt>
          <dd className="text-sm font-medium tabular-nums text-foreground">
            {formatKm(route.distanceKm)}
          </dd>
        </div>
        <div className="bg-card px-3 py-2.5">
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Litros estimados
          </dt>
          <dd className="text-sm font-medium tabular-nums text-foreground">
            {formatLiters(route.fuel.liters)}
          </dd>
        </div>
        <div className="bg-card px-3 py-2.5">
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Preço</dt>
          <dd
            data-testid="fuel-price"
            className="text-sm font-medium tabular-nums text-foreground"
          >
            {formatCurrency(pricePerL)}/l
          </dd>
        </div>
      </dl>

      <div className="flex items-baseline justify-between rounded-md bg-secondary px-3 py-2.5">
        <span className="text-sm font-medium text-secondary-foreground">
          Custo total de combustível
        </span>
        <span
          data-testid="fuel-cost"
          className="text-base font-bold tabular-nums text-primary"
        >
          {formatCurrency(route.fuel.cost)}
        </span>
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {formatLiters(route.fuel.liters)} × {formatCurrency(pricePerL)}/l ={' '}
        {formatCurrency(route.fuel.cost)}. Estimativa para consumo constante, sem considerar
        relevo, carga ou trânsito.
      </p>
    </div>
  );
}
