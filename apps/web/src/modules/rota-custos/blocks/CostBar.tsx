import { formatCurrency } from '@/lib/format';

/** Stacked bar: fuel vs tolls. `role="img"` with the values in its label. */
export function CostBar({ fuel, toll }: { fuel: number; toll: number }) {
  const sum = fuel + toll;
  const fuelPct = sum > 0 ? (fuel / sum) * 100 : 0;
  const tollPct = sum > 0 ? (toll / sum) * 100 : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="img"
        aria-label={`Composição do custo: combustível ${formatCurrency(fuel)}, pedágios ${formatCurrency(toll)}`}
        className="flex h-2.5 w-full overflow-hidden rounded-full bg-secondary"
      >
        <div className="h-full bg-primary" style={{ width: `${fuelPct}%` }} />
        <div className="h-full bg-accent" style={{ width: `${tollPct}%` }} />
      </div>
      <div aria-hidden className="flex justify-between text-[11px] text-muted-foreground">
        <span className="flex gap-1.5">
          <span>Combustível</span>
          <span className="font-medium tabular-nums text-foreground">{formatCurrency(fuel)}</span>
        </span>
        <span className="flex gap-1.5">
          <span>Pedágios</span>
          <span className="font-medium tabular-nums text-foreground">{formatCurrency(toll)}</span>
        </span>
      </div>
    </div>
  );
}
