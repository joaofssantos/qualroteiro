import { MapSlot } from '@/core/layout/MapHost';
import { cn } from '@/lib/utils';

/**
 * O mapa do resultado, em cartão. Reusa o `MapSlot` do `AppShell` — o mesmo nó
 * DOM do único `MapCanvas`; nunca monta um segundo mapa.
 */
export function MapCard({ className }: { className?: string }) {
  return (
    <div
      data-testid="map-card"
      className={cn('overflow-hidden rounded-lg border border-border bg-card shadow-sm', className)}
    >
      <MapSlot className="h-72 w-full md:h-full md:min-h-[22rem]" />
    </div>
  );
}
