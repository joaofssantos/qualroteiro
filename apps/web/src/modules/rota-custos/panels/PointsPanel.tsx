import { Fuel, TicketCheck } from 'lucide-react';
import type { ComponentType } from 'react';

import { EmptyState } from '@/components/ui/card';
import type { PlannedRoute } from '@/core/api/types';
import type { LayerState } from '@/core/store/routeStore';
import { cn } from '@/lib/utils';

/**
 * "Pontos na rota" — the layer manager's user interface.
 *
 * The switches drive the map's layers through the store; the map has no idea a
 * plaza is a plaza. Adding a layer to this panel is adding it to the module's
 * `mapLayers`, not editing the map.
 */

function LayerSwitch({
  layer,
  count,
  icon: Icon,
  onToggle,
}: {
  layer: LayerState;
  count: number;
  icon: ComponentType<{ className?: string }>;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2.5">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{layer.label}</span>
        <span className="block text-xs text-muted-foreground">
          {count === 0 ? 'nenhum ponto nesta rota' : `${count} no trajeto`}
        </span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={layer.visible}
        aria-label={layer.label}
        onClick={onToggle}
        className={cn(
          'relative h-5 w-9 shrink-0 rounded-full transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          layer.visible ? 'bg-primary' : 'bg-input',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform',
            layer.visible ? 'translate-x-[1.125rem]' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}

export function PointsPanel({
  route,
  layers,
  onToggleLayer,
  tollLayerId,
  fuelStationLayerId,
}: {
  route: PlannedRoute;
  layers: readonly LayerState[];
  onToggleLayer: (id: string) => void;
  tollLayerId: string;
  fuelStationLayerId: string;
}) {
  const counts: Record<string, number> = {
    [tollLayerId]: route.points.tolls.length,
    [fuelStationLayerId]: route.points.fuelStations.length,
  };
  const icons: Record<string, ComponentType<{ className?: string }>> = {
    [tollLayerId]: TicketCheck,
    [fuelStationLayerId]: Fuel,
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Escolha o que aparece no mapa.
      </p>

      <div className="flex flex-col gap-1.5">
        {layers.map((layer) => (
          <LayerSwitch
            key={layer.id}
            layer={layer}
            count={counts[layer.id] ?? 0}
            icon={icons[layer.id] ?? TicketCheck}
            onToggle={() => onToggleLayer(layer.id)}
          />
        ))}
      </div>

      {/*
        The section is rendered, not hidden. `points.fuelStations` is empty by
        contract in this phase — the API has no station data upstream — and saying
        so is more honest than a panel that silently omits a feature the user was
        told about.
      */}
      {route.points.fuelStations.length === 0 ? (
        <EmptyState
          title="Sem dados de postos nesta fase"
          description="A camada de postos já existe no mapa e será preenchida quando a base de combustíveis entrar."
        />
      ) : null}
    </div>
  );
}
