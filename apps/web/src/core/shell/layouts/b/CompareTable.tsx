import type { PlannedRoute } from '@/core/api/types';
import { Chip } from '@/components/ui/chip';
import { formatCurrency, formatDuration, formatKm } from '@/lib/format';
import { cn } from '@/lib/utils';

function isPartial(route: PlannedRoute): boolean {
  return (route.tolls.unavailablePlazaIds?.length ?? 0) > 0;
}

/**
 * Alternativas lado a lado. A linha inteira é clicável; o botão na primeira
 * coluna dá o mesmo por teclado. O menor total só é destacado entre rotas com
 * total completo — um total parcial não é comparável.
 */
export function CompareTable({
  routes,
  labels,
  selectedIndex,
  onSelect,
}: {
  routes: readonly PlannedRoute[];
  labels: readonly string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  const totals = routes.map((r) => r.fuel.cost + r.tolls.total);
  let best = -1;
  routes.forEach((route, i) => {
    if (isPartial(route) || routes.length < 2) return;
    if (best === -1 || totals[i]! < totals[best]!) best = i;
  });

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table aria-label="Comparação de alternativas" className="w-full min-w-[34rem] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <th scope="col" className="px-3 py-2 font-medium">Alternativa</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Distância</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Tempo</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Combustível</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Pedágios</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {routes.map((route, index) => {
            const label = labels[index] ?? `Alternativa ${index + 1}`;
            const selected = index === selectedIndex;
            const partial = isPartial(route);
            return (
              <tr
                key={index}
                aria-selected={selected}
                onClick={() => onSelect(index)}
                className={cn(
                  'cursor-pointer border-b border-border last:border-b-0 transition-colors motion-reduce:transition-none',
                  selected ? 'bg-secondary' : 'hover:bg-secondary/60',
                )}
              >
                <td className="px-3 py-2">
                  <button
                    type="button"
                    aria-label={`Selecionar ${label}`}
                    aria-current={selected ? 'true' : undefined}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect(index);
                    }}
                    className="flex min-h-[44px] items-center gap-2 rounded-md text-left font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span>{label}</span>
                    {index === best ? <Chip tone="success">Menor total</Chip> : null}
                  </button>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatKm(route.distanceKm)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatDuration(route.durationMin)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(route.fuel.cost)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(route.tolls.total)}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-primary">
                  {formatCurrency(totals[index]!)}
                  {partial ? (
                    <span className="block text-[11px] font-normal text-muted-foreground">Total parcial</span>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
