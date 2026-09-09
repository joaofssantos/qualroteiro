import { AXLE_CATEGORIES } from '@qualroteiro/tolls';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { AxleCategory, TollPlaza } from '@/core/api/types';
import { AXLE_LABELS } from '@/core/components/VehicleProfileForm';
import { formatCurrency, formatKmMarker } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Tela 3 — detalhe da praça.
 *
 * Opened from either the map marker or the Pedágios list; one component serves
 * both so the two entry points cannot drift apart.
 *
 * It shows the *whole* tariff table, not just the selected category, because the
 * question this drawer exists to answer is usually "what would it cost if I took
 * the truck instead" — and answering it should not mean going back to the form.
 */
export function PlazaDrawer({
  plaza,
  axleCategory,
  onClose,
}: {
  plaza: TollPlaza | null;
  axleCategory: AxleCategory;
  onClose: () => void;
}) {
  return (
    <Sheet open={plaza !== null} onOpenChange={(open) => !open && onClose()}>
      {plaza ? (
        <SheetContent aria-describedby={undefined}>
          <SheetHeader>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-accent-foreground">
              Praça de pedágio
            </span>
            <SheetTitle>{plaza.name}</SheetTitle>
            <SheetDescription>Tarifas por categoria de veículo</SheetDescription>
          </SheetHeader>

          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border">
            <div className="bg-card px-3 py-2.5">
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Concessionária
              </dt>
              <dd className="text-sm font-medium text-foreground">{plaza.concessionaire}</dd>
            </div>
            <div className="bg-card px-3 py-2.5">
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Rodovia
              </dt>
              <dd className="text-sm font-medium text-foreground">{plaza.highway}</dd>
            </div>
            <div className="bg-card px-3 py-2.5">
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Quilômetro
              </dt>
              <dd className="text-sm font-medium tabular-nums text-foreground">
                {formatKmMarker(plaza.km)}
              </dd>
            </div>
            <div className="bg-card px-3 py-2.5">
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Coordenadas
              </dt>
              <dd className="text-sm font-medium tabular-nums text-foreground">
                {plaza.lat.toFixed(4)}, {plaza.lng.toFixed(4)}
              </dd>
            </div>
          </dl>

          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Tarifas por categoria de eixo</caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Categoria
                </th>
                <th scope="col" className="py-2 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Tarifa
                </th>
              </tr>
            </thead>
            <tbody>
              {AXLE_CATEGORIES.map((category) => (
                <tr
                  key={category}
                  className={cn(
                    'border-b border-border/60',
                    category === axleCategory && 'bg-accent/10',
                  )}
                >
                  <th
                    scope="row"
                    className={cn(
                      'py-2 pr-3 text-left font-normal text-foreground',
                      category === axleCategory && 'font-semibold',
                    )}
                  >
                    {AXLE_LABELS[category]}
                    {category === axleCategory ? (
                      <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-accent-foreground">
                        selecionada
                      </span>
                    ) : null}
                  </th>
                  <td className="py-2 text-right tabular-nums text-foreground">
                    {formatCurrency(plaza.tariffByAxleCategory[category])}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Valores de referência da base de demonstração desta fase (2024–2025).
          </p>
        </SheetContent>
      ) : null}
    </Sheet>
  );
}
