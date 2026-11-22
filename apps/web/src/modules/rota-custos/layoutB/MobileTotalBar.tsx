import type { PlannedRoute } from '@/core/api/types';
import { SaveRouteToTripDialog } from '../SaveRouteToTripDialog';
import { formatCurrency } from '@/lib/format';

/** Barra fixa inferior (mobile): total sempre à vista + Salvar. */
export function MobileTotalBar({
  route,
  title,
  partial,
}: {
  route: PlannedRoute;
  title: string;
  partial: boolean;
}) {
  return (
    <div
      data-testid="mobile-total-bar"
      className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-border bg-card px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] shadow-lg"
    >
      <div className="min-w-0">
        <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">
          {partial ? 'Total parcial' : 'Total'}
        </span>
        <span className="block text-xl font-bold tabular-nums text-primary">
          {formatCurrency(route.fuel.cost + route.tolls.total)}
        </span>
      </div>
      <SaveRouteToTripDialog route={route} title={title} />
    </div>
  );
}
