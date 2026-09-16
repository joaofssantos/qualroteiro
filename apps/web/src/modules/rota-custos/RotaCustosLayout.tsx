import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import type { TollPlaza } from '@/core/api/types';
import type { MapLayerData, RouteTrace } from '@/core/map/layers';
import { useMapStore } from '@/core/map/mapStore';
import { selectActiveRoute, useRouteStore } from '@/core/store/routeStore';
import { formatCurrency } from '@/lib/format';

import { PlazaDrawer } from './PlazaDrawer';
import { ENDPOINT_LAYER_ID, FUEL_STATION_LAYER_ID, MODULE_PATH, TOLL_LAYER_ID } from './module';

export interface RotaCustosOutletContext {
  onSelectPlaza(plaza: TollPlaza | null): void;
}

/**
 * No longer mounts its own `<MapCanvas>` or a divided layout — `AppShell` owns
 * both now (`rotaCustosModule.showMap === true`). This component computes the
 * same layers/trace it always did and *publishes* them to `core/map/mapStore`
 * instead of passing them as props, which is what lets the map survive
 * navigating to Tela 2 and back without unmounting.
 */
export function RotaCustosLayout() {
  const location = useLocation();
  const query = useRouteStore((s) => s.query);
  const routes = useRouteStore((s) => s.routes);
  const activeIndex = useRouteStore((s) => s.activeIndex);
  const layers = useRouteStore((s) => s.layers);
  const endpointMarkers = useRouteStore((s) => s.endpointMarkers);

  const setMapLayers = useMapStore((s) => s.setMapLayers);
  const setMapTrace = useMapStore((s) => s.setMapTrace);
  const setOnMarkerClick = useMapStore((s) => s.setOnMarkerClick);
  const clearMap = useMapStore((s) => s.clearMap);

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

  const trace = useMemo<RouteTrace | null>(
    () =>
      showingResult && route
        ? {
            coordinates: route.geometry.coordinates.map(
              (coordinate) => [coordinate[0], coordinate[1]] as const,
            ),
          }
        : null,
    [route, showingResult],
  );

  // Publish the computed layers/trace to the shared map store whenever they
  // change — this replaces passing them as `<MapCanvas>` props directly.
  useEffect(() => {
    setMapLayers(mapLayers);
    setMapTrace(trace);
  }, [mapLayers, trace, setMapLayers, setMapTrace]);

  // Re-published whenever `route` changes rather than defined once, so a click
  // always resolves against the alternative currently selected.
  useEffect(() => {
    setOnMarkerClick((layerId, markerId) => {
      if (!route || layerId !== TOLL_LAYER_ID) return;
      setSelectedPlaza(route.points.tolls.find((plaza) => plaza.id === markerId) ?? null);
    });
  }, [route, setOnMarkerClick]);

  // The cleanup contract `mapStore` documents: nothing this module published
  // should survive navigating away from it.
  useEffect(() => {
    return () => clearMap();
  }, [clearMap]);

  return (
    <>
      <Outlet context={{ onSelectPlaza: setSelectedPlaza } satisfies RotaCustosOutletContext} />

      <PlazaDrawer
        plaza={selectedPlaza}
        axleCategory={query?.vehicle.axleCategory ?? 'car'}
        onClose={() => setSelectedPlaza(null)}
      />
    </>
  );
}
