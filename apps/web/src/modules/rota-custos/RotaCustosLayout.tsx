import { useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import type { TollPlaza } from '@/core/api/types';
import { MapCanvas } from '@/core/map/MapCanvas';
import type { MapLayerData } from '@/core/map/layers';
import { selectActiveRoute, useRouteStore } from '@/core/store/routeStore';
import { formatCurrency } from '@/lib/format';

import { PlazaDrawer } from './PlazaDrawer';
import { ENDPOINT_LAYER_ID, FUEL_STATION_LAYER_ID, MODULE_PATH, TOLL_LAYER_ID } from './module';

export interface RotaCustosOutletContext {
  onSelectPlaza(plaza: TollPlaza | null): void;
}

export function RotaCustosLayout() {
  const location = useLocation();
  const query = useRouteStore((s) => s.query);
  const routes = useRouteStore((s) => s.routes);
  const activeIndex = useRouteStore((s) => s.activeIndex);
  const layers = useRouteStore((s) => s.layers);
  const endpointMarkers = useRouteStore((s) => s.endpointMarkers);

  const [selectedPlaza, setSelectedPlaza] = useState<TollPlaza | null>(null);

  const route = selectActiveRoute({ routes, activeIndex });
  const showingResult = location.pathname === `${MODULE_PATH}/resultado`;

  const mapLayers = useMemo<readonly (MapLayerData & { visible: boolean })[]>(() => {
    const endpointsLayer: MapLayerData & { visible: boolean } = {
      id: ENDPOINT_LAYER_ID,
      label: 'Origem, destino e paradas',
      visible: true,
      markers: endpointMarkers.map((marker) => ({
        id: marker.id,
        lng: marker.place.lng,
        lat: marker.place.lat,
        label: marker.label,
        kind: marker.kind,
      })),
    };

    if (!showingResult || !route) return [endpointsLayer];

    const axleCategory = query?.vehicle.axleCategory ?? 'car';
    const routeLayers = layers.map((layer) => {
      if (layer.id === TOLL_LAYER_ID) {
        return {
          ...layer,
          markers: route.points.tolls.map((plaza) => ({
            id: plaza.id,
            lng: plaza.lng,
            lat: plaza.lat,
            label: `${plaza.name} - ${formatCurrency(plaza.tariffByAxleCategory[axleCategory])}`,
            kind: 'toll' as const,
          })),
        };
      }
      if (layer.id === FUEL_STATION_LAYER_ID) {
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

    return [endpointsLayer, ...routeLayers];
  }, [endpointMarkers, layers, query, route, showingResult]);

  const trace = useMemo(
    () =>
      showingResult && route
        ? route.geometry.coordinates.map((coordinate) => [coordinate[0], coordinate[1]] as const)
        : null,
    [route, showingResult],
  );

  return (
    <div className="flex h-[calc(100vh-3.25rem)] flex-col md:h-screen md:flex-row">
      <div
        data-testid="rota-custos-map-container"
        className="relative h-[38vh] min-h-[240px] shrink-0 md:h-auto md:min-h-0 md:flex-1"
      >
        <MapCanvas
          trace={trace}
          layers={mapLayers}
          onMarkerClick={(layerId, markerId) => {
            if (!route || layerId !== TOLL_LAYER_ID) return;
            setSelectedPlaza(route.points.tolls.find((plaza) => plaza.id === markerId) ?? null);
          }}
        />
      </div>

      <Outlet context={{ onSelectPlaza: setSelectedPlaza } satisfies RotaCustosOutletContext} />

      <PlazaDrawer
        plaza={selectedPlaza}
        axleCategory={query?.vehicle.axleCategory ?? 'car'}
        onClose={() => setSelectedPlaza(null)}
      />
    </div>
  );
}
