import { ArrowLeft } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { TollPlaza } from '@/core/api/types';
import { MapCanvas } from '@/core/map/MapCanvas';
import type { MapLayerData } from '@/core/map/layers';
import { selectActiveRoute, useRouteStore } from '@/core/store/routeStore';
import { formatCurrency } from '@/lib/format';

import { PlazaDrawer } from './PlazaDrawer';
import { FUEL_STATION_LAYER_ID, MODULE_PATH, TOLL_LAYER_ID } from './module';
import { AlternativesPanel } from './panels/AlternativesPanel';
import { FuelPanel } from './panels/FuelPanel';
import { PointsPanel } from './panels/PointsPanel';
import { SummaryRow } from './panels/SummaryRow';
import { TollsPanel } from './panels/TollsPanel';

/**
 * Tela 2 — resultado. Split layout: map on the left, costs on the right.
 *
 * The map and the panel both read the *active alternative* from the store, so
 * selecting an alternative moves them together by construction rather than by two
 * separate update paths that could disagree.
 */
export function ResultScreen() {
  const query = useRouteStore((s) => s.query);
  const routes = useRouteStore((s) => s.routes);
  const activeIndex = useRouteStore((s) => s.activeIndex);
  const layers = useRouteStore((s) => s.layers);
  const setActiveIndex = useRouteStore((s) => s.setActiveIndex);
  const toggleLayer = useRouteStore((s) => s.toggleLayer);

  const [selectedPlaza, setSelectedPlaza] = useState<TollPlaza | null>(null);

  const route = selectActiveRoute({ routes, activeIndex });

  /** Translate the active route's points into the map's own vocabulary. */
  const mapLayers = useMemo<readonly (MapLayerData & { visible: boolean })[]>(() => {
    if (!route) return [];
    const axleCategory = query?.vehicle.axleCategory ?? 'car';

    return layers.map((layer) => {
      if (layer.id === TOLL_LAYER_ID) {
        return {
          ...layer,
          markers: route.points.tolls.map((plaza) => ({
            id: plaza.id,
            lng: plaza.lng,
            lat: plaza.lat,
            label: `${plaza.name} — ${formatCurrency(plaza.tariffByAxleCategory[axleCategory])}`,
            kind: 'toll' as const,
          })),
        };
      }
      if (layer.id === FUEL_STATION_LAYER_ID) {
        // Always empty in F1; the layer exists so nothing changes when it is not.
        return {
          ...layer,
          markers: route.points.fuelStations.map((station) => ({
            id: station.id,
            lng: station.lng,
            lat: station.lat,
            label: station.name,
            kind: 'fuel' as const,
          })),
        };
      }
      return { ...layer, markers: [] };
    });
  }, [route, layers, query]);

  const trace = useMemo(
    () => (route ? route.geometry.coordinates.map((c) => [c[0], c[1]] as const) : null),
    [route],
  );

  // Reached by URL with nothing planned — send the user to the form rather than
  // rendering an empty result.
  if (!route || !query) return <Navigate to={MODULE_PATH} replace />;

  return (
    <div className="flex h-[calc(100vh-3.25rem)] flex-col md:h-screen md:flex-row">
      <div className="relative h-[38vh] min-h-[240px] shrink-0 md:h-auto md:min-h-0 md:flex-1">
        <MapCanvas
          trace={trace}
          layers={mapLayers}
          onMarkerClick={(layerId, markerId) => {
            if (layerId !== TOLL_LAYER_ID) return;
            setSelectedPlaza(route.points.tolls.find((p) => p.id === markerId) ?? null);
          }}
        />
      </div>

      <aside
        aria-label="Custos da rota"
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto border-border bg-background p-4 md:w-[26rem] md:flex-none md:border-l md:p-5"
      >
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground">
            <Link to={MODULE_PATH}>
              <ArrowLeft /> Nova consulta
            </Link>
          </Button>
          <h1 className="text-lg font-bold tracking-tight text-primary">Resultado da rota</h1>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {query.originLabel} → {query.destinationLabel}
          </p>
        </div>

        <SummaryRow route={route} />

        <Tabs defaultValue="pedagios" className="flex min-h-0 flex-col">
          <TabsList>
            <TabsTrigger value="pedagios">Pedágios</TabsTrigger>
            <TabsTrigger value="combustivel">Combustível</TabsTrigger>
            <TabsTrigger value="pontos">Pontos na rota</TabsTrigger>
            <TabsTrigger value="alternativas">Alternativas</TabsTrigger>
          </TabsList>

          <TabsContent value="pedagios">
            <TollsPanel
              route={route}
              axleCategory={query.vehicle.axleCategory}
              onSelectPlaza={setSelectedPlaza}
            />
          </TabsContent>

          <TabsContent value="combustivel">
            <FuelPanel
              route={route}
              pricePerL={query.fuelPricePerL}
              consumptionKmPerL={query.vehicle.consumptionKmPerL}
            />
          </TabsContent>

          <TabsContent value="pontos">
            <PointsPanel
              route={route}
              layers={layers}
              onToggleLayer={toggleLayer}
              tollLayerId={TOLL_LAYER_ID}
              fuelStationLayerId={FUEL_STATION_LAYER_ID}
            />
          </TabsContent>

          <TabsContent value="alternativas">
            <AlternativesPanel
              routes={routes}
              activeIndex={activeIndex}
              onSelect={setActiveIndex}
            />
          </TabsContent>
        </Tabs>
      </aside>

      <PlazaDrawer
        plaza={selectedPlaza}
        axleCategory={query.vehicle.axleCategory}
        onClose={() => setSelectedPlaza(null)}
      />
    </div>
  );
}
