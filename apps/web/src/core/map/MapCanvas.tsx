import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

import { DEFAULT_MARKER_STYLE, MARKER_STYLES, type MapLayerData, boundsOf } from './layers';

/**
 * The map, wrapped.
 *
 * `MapCanvas` knows about a *trace* and about *layers of labelled markers*. It has
 * never heard of a toll plaza, a fuel station or a route alternative, which is
 * what lets a future module put its own points on the map without this file
 * changing.
 *
 * MapLibre is imperative and owns its own DOM, so the map is created once in an
 * effect and subsequently *mutated* — React re-rendering a `<Map>` element on
 * every state change would tear down a WebGL context sixty times a second. The
 * component's own render output is therefore just an empty container div.
 */

/**
 * A style that needs no API key, so the app runs for a new contributor with an
 * empty `.env`. Override with `VITE_MAP_STYLE_URL`.
 */
const DEFAULT_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const STYLE_URL = import.meta.env.VITE_MAP_STYLE_URL ?? DEFAULT_STYLE_URL;

/** Centred on the Sudeste, the corridors the F1 toll seed covers. */
const INITIAL_CENTER: [number, number] = [-45.5, -22.5];
const INITIAL_ZOOM = 6;

const ROUTE_SOURCE = 'route';
const ROUTE_LINE_LAYER = 'route-line';
const ROUTE_CASING_LAYER = 'route-casing';

export interface MapCanvasProps {
  /** The active route's positions, or `null` when there is nothing to draw. */
  trace: readonly (readonly [number, number])[] | null;
  /** Marker layers. A layer with `visible: false` draws nothing. */
  layers: readonly (MapLayerData & { visible: boolean })[];
  /** Called with the layer id and marker id of whatever the user clicked. */
  onMarkerClick?: (layerId: string, markerId: string) => void;
  className?: string;
  /** Accessible name for the map region. */
  label?: string;
}

/** Build the DOM node MapLibre will position. A real button, so it is clickable. */
function markerElement(
  label: string,
  kind: string | undefined,
  onClick: (() => void) | undefined,
): HTMLButtonElement {
  const style = (kind ? MARKER_STYLES[kind] : undefined) ?? DEFAULT_MARKER_STYLE;
  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.title = label;
  button.style.cssText = [
    'width:16px',
    'height:16px',
    'border-radius:9999px',
    'cursor:pointer',
    'padding:0',
    `background:${style.bg}`,
    `border:2px solid ${style.ring}`,
    'box-shadow:0 1px 3px rgba(0,0,0,.35)',
  ].join(';');
  if (onClick) button.addEventListener('click', onClick);
  return button;
}

export function MapCanvas({
  trace,
  layers,
  onMarkerClick,
  className,
  label = 'Mapa da rota',
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef(new Map<string, maplibregl.Marker>());
  const [ready, setReady] = useState(false);

  /**
   * Held in a ref so that changing the click handler does not force every marker
   * to be destroyed and rebuilt — the handler is read at click time.
   */
  const onMarkerClickRef = useRef(onMarkerClick);
  onMarkerClickRef.current = onMarkerClick;

  // Create the map once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = new maplibregl.Map({
      container,
      style: STYLE_URL,
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('load', () => setReady(true));

    // Captured here rather than read from the ref in the cleanup: the ref's
    // current value could in principle have been swapped by the time teardown
    // runs, and we must tear down the markers this effect actually created.
    const markers = markersRef.current;

    return () => {
      for (const marker of markers.values()) marker.remove();
      markers.clear();
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  // Draw (or redraw) the route trace.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    // GeoJSON's `Position[]` is mutable, while the domain types (and this
    // component's props) are `readonly` all the way down — deliberately, so a
    // route geometry cannot be mutated in place. Copy each position into a fresh
    // mutable tuple at the boundary rather than casting the readonly-ness away.
    const feature: GeoJSON.Feature<GeoJSON.LineString> = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: trace ? trace.map(([lng, lat]) => [lng, lat]) : [],
      },
    };

    const source = map.getSource(ROUTE_SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(feature);
    } else {
      map.addSource(ROUTE_SOURCE, { type: 'geojson', data: feature });
      // A darker casing under a lighter line is what makes a route legible over
      // arbitrary basemap colours.
      map.addLayer({
        id: ROUTE_CASING_LAYER,
        type: 'line',
        source: ROUTE_SOURCE,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#0b3a52', 'line-width': 8, 'line-opacity': 0.9 },
      });
      map.addLayer({
        id: ROUTE_LINE_LAYER,
        type: 'line',
        source: ROUTE_SOURCE,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#f6a723', 'line-width': 4 },
      });
    }

    const bounds = trace ? boundsOf(trace) : null;
    if (bounds) {
      map.fitBounds(bounds, { padding: 64, duration: 400, maxZoom: 13 });
    }
  }, [trace, ready]);

  // Reconcile markers against the visible layers.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const wanted = new Map<string, { lng: number; lat: number; label: string; kind?: string; layerId: string; markerId: string }>();
    for (const layer of layers) {
      if (!layer.visible) continue;
      for (const marker of layer.markers) {
        wanted.set(`${layer.id}:${marker.id}`, {
          lng: marker.lng,
          lat: marker.lat,
          label: marker.label,
          ...(marker.kind !== undefined ? { kind: marker.kind } : {}),
          layerId: layer.id,
          markerId: marker.id,
        });
      }
    }

    // Remove what is no longer wanted — this is the "toggle off" path.
    for (const [key, marker] of markersRef.current) {
      if (!wanted.has(key)) {
        marker.remove();
        markersRef.current.delete(key);
      }
    }

    // Add what is newly wanted. Markers that persist are left alone so toggling
    // an unrelated layer does not make every other marker flicker.
    for (const [key, spec] of wanted) {
      if (markersRef.current.has(key)) continue;
      const element = markerElement(spec.label, spec.kind, () =>
        onMarkerClickRef.current?.(spec.layerId, spec.markerId),
      );
      const marker = new maplibregl.Marker({ element })
        .setLngLat([spec.lng, spec.lat])
        .addTo(map);
      markersRef.current.set(key, marker);
    }
  }, [layers, ready]);

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label={label}
      className={cn('h-full w-full bg-secondary', className)}
    />
  );
}
