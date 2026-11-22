/**
 * Prévia do traçado (F9): enquanto o usuário escolhe origem e destino, desenha no
 * mapa uma linha tracejada com a rota provável — antes do "Calcular".
 *
 * Cada prévia é uma chamada real a `POST /routes/plan` (e consome cota do provedor
 * de rotas), então o hook é conservador: só dispara com origem e destino em
 * coordenadas, espera 700 ms de calma, mantém no máximo 1 chamada em voo (mudou a
 * chave → aborta a anterior), guarda o resultado por chave e nunca tenta de novo.
 * Qualquer falha (422, 429/`Retry-After`, rede, aborto) vira `status: 'error'`,
 * sem toast: o "Calcular" continua sendo a única fonte de erro e de `routeStore.routes`.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { planRoute } from '@/core/api/client';
import type { PlaceInput, PlanRouteRequest } from '@/core/api/types';
import type { RouteTrace } from '@/core/map/layers';
import { useMapStore } from '@/core/map/mapStore';

import { DEFAULT_VEHICLE } from './routeDraftStore';
import type { VehicleProfileValue } from '@/core/components/VehicleProfileForm';

export const PREVIEW_DEBOUNCE_MS = 700;

export interface PlanPreviewInput {
  readonly origin: PlaceInput | null;
  readonly destination: PlaceInput | null;
  readonly stops: readonly PlaceInput[];
  readonly vehicle: VehicleProfileValue;
  readonly enabled: boolean;
}

export interface PlanPreviewSummary {
  readonly km: number;
  readonly minutes: number;
}

export interface PlanPreviewState {
  readonly status: 'idle' | 'loading' | 'ready' | 'error';
  readonly summary: PlanPreviewSummary | null;
}

interface PreviewResult {
  readonly trace: RouteTrace;
  readonly summary: PlanPreviewSummary;
}

const IDLE: PlanPreviewState = { status: 'idle', summary: null };

/** Resultados já obtidos, por chave: voltar à mesma consulta não refaz a chamada. */
const resultCache = new Map<string, PreviewResult>();

export function clearPreviewCache(): void {
  resultCache.clear();
}

function isCoordinate(place: PlaceInput | null): place is { lng: number; lat: number } {
  return (
    place !== null &&
    typeof place === 'object' &&
    Number.isFinite(place.lng) &&
    Number.isFinite(place.lat)
  );
}

/** Veículo inválido (consumo ≤ 0, preço negativo) cai no padrão, como a prévia não deve falhar por isso. */
function sanitizeVehicle(vehicle: VehicleProfileValue): VehicleProfileValue {
  const validConsumption = Number.isFinite(vehicle.consumptionKmPerL) && vehicle.consumptionKmPerL > 0;
  const validPrice = Number.isFinite(vehicle.fuelPricePerL) && vehicle.fuelPricePerL >= 0;
  return validConsumption && validPrice ? vehicle : DEFAULT_VEHICLE;
}

const r5 = (n: number): string => n.toFixed(5);
const coord = (p: { lng: number; lat: number }): string => `${r5(p.lng)},${r5(p.lat)}`;

/** Chave de cache/disparo; `null` quando falta coordenada (texto livre nunca dispara). */
export function previewKey(input: Omit<PlanPreviewInput, 'enabled'> & { enabled?: boolean }): string | null {
  const { origin, destination } = input;
  if (!isCoordinate(origin) || !isCoordinate(destination)) return null;

  const stops: string[] = [];
  for (const stop of input.stops) {
    if (typeof stop === 'string' && stop.trim() === '') continue; // parada em branco não conta
    if (!isCoordinate(stop)) return null;
    stops.push(coord(stop));
  }

  const v = sanitizeVehicle(input.vehicle);
  return [
    coord(origin),
    coord(destination),
    stops.join(';'),
    `${v.type}/${v.axleCategory}/${v.consumptionKmPerL}/${v.fuelPricePerL}`,
  ].join('|');
}

function buildRequest(input: PlanPreviewInput): PlanRouteRequest {
  const v = sanitizeVehicle(input.vehicle);
  return {
    origin: input.origin as PlaceInput,
    destination: input.destination as PlaceInput,
    waypoints: input.stops.filter((s) => !(typeof s === 'string' && s.trim() === '')),
    vehicle: { type: v.type, axleCategory: v.axleCategory, consumptionKmPerL: v.consumptionKmPerL },
    fuelPricePerL: v.fuelPricePerL,
  };
}

export function usePlanPreview(input: PlanPreviewInput): PlanPreviewState {
  const key = input.enabled ? previewKey(input) : null;
  const inputRef = useRef(input);
  inputRef.current = input;
  const [state, setState] = useState<PlanPreviewState>(IDLE);

  useEffect(() => {
    const { setMapPreview, requestFit } = useMapStore.getState();

    if (key === null) {
      setState(IDLE);
      setMapPreview(null);
      return;
    }

    const publish = (result: PreviewResult) => {
      setState({ status: 'ready', summary: result.summary });
      setMapPreview(result.trace);
      requestFit();
    };

    const cached = resultCache.get(key);
    if (cached) {
      publish(cached);
      return () => setMapPreview(null);
    }

    setState(IDLE);
    setMapPreview(null);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setState({ status: 'loading', summary: null });
      planRoute(buildRequest(inputRef.current), controller.signal).then(
        (routes) => {
          if (controller.signal.aborted) return;
          const first = routes[0];
          if (!first || first.geometry.coordinates.length < 2) {
            setState({ status: 'error', summary: null });
            return;
          }
          const result: PreviewResult = {
            trace: { coordinates: first.geometry.coordinates.map(([lng, lat]) => [lng, lat] as const) },
            summary: { km: first.distanceKm, minutes: first.durationMin },
          };
          resultCache.set(key, result);
          publish(result);
        },
        () => {
          // 422, 429, rede, aborto: silencioso, sem retry automático.
          if (controller.signal.aborted) return;
          setState({ status: 'error', summary: null });
          setMapPreview(null);
        },
      );
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
      setMapPreview(null);
    };
  }, [key]);

  return useMemo(() => (key === null ? IDLE : state), [key, state]);
}
