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

interface InFlightPreview {
  readonly controller: AbortController;
  readonly promise: Promise<readonly import('@/core/api/types').PlannedRoute[]>;
  subscribers: number;
  abortTimer: ReturnType<typeof setTimeout> | null;
}

/**
 * Uma troca de shell A↔B pode desmontar e montar o mesmo preview na mesma
 * atualização do React. Guardar a requisição fora do hook permite que o novo
 * consumidor da mesma chave se inscreva nela em vez de abrir outra chamada.
 */
const inFlightPreviews = new Map<string, InFlightPreview>();

export function clearPreviewCache(): void {
  for (const preview of inFlightPreviews.values()) {
    if (preview.abortTimer !== null) clearTimeout(preview.abortTimer);
    preview.controller.abort();
  }
  inFlightPreviews.clear();
  resultCache.clear();
}

function subscribeToInFlight(key: string, request: PlanRouteRequest): InFlightPreview {
  const existing = inFlightPreviews.get(key);
  if (existing) {
    existing.subscribers += 1;
    if (existing.abortTimer !== null) {
      clearTimeout(existing.abortTimer);
      existing.abortTimer = null;
    }
    return existing;
  }

  const controller = new AbortController();
  const preview: InFlightPreview = {
    controller,
    promise: planRoute(request, controller.signal),
    subscribers: 1,
    abortTimer: null,
  };
  inFlightPreviews.set(key, preview);
  void preview.promise.then(
    () => {
      if (inFlightPreviews.get(key) === preview) inFlightPreviews.delete(key);
    },
    () => {
      if (inFlightPreviews.get(key) === preview) inFlightPreviews.delete(key);
    },
  );
  return preview;
}

function unsubscribeFromInFlight(key: string, preview: InFlightPreview): void {
  preview.subscribers -= 1;
  if (preview.subscribers > 0 || preview.abortTimer !== null) return;

  // O próximo consumidor da mesma chave (como na troca A↔B) nasce antes do
  // próximo tick. Se ele não vier, a chamada que ficou sem consumidor é abortada.
  preview.abortTimer = setTimeout(() => {
    preview.abortTimer = null;
    if (preview.subscribers !== 0 || inFlightPreviews.get(key) !== preview) return;
    preview.controller.abort();
    inFlightPreviews.delete(key);
  }, 0);
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
    let active = true;
    let inFlight: InFlightPreview | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const observe = (preview: InFlightPreview) => {
      inFlight = preview;
      preview.promise.then(
        (routes) => {
          if (!active || inFlight?.controller.signal.aborted) return;
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
          if (!active || inFlight?.controller.signal.aborted) return;
          setState({ status: 'error', summary: null });
          setMapPreview(null);
        },
      );
    };

    // Não aguarda outro debounce para voltar a uma promessa já iniciada: isso
    // mantém a promessa de K viva no intervalo cleanup→effect da troca A↔B.
    if (inFlightPreviews.has(key)) {
      setState({ status: 'loading', summary: null });
      observe(subscribeToInFlight(key, buildRequest(inputRef.current)));
    } else {
      timer = setTimeout(() => {
        setState({ status: 'loading', summary: null });
        observe(subscribeToInFlight(key, buildRequest(inputRef.current)));
      }, PREVIEW_DEBOUNCE_MS);
    }

    return () => {
      active = false;
      if (timer !== null) clearTimeout(timer);
      if (inFlight) unsubscribeFromInFlight(key, inFlight);
      setMapPreview(null);
    };
  }, [key]);

  return useMemo(() => (key === null ? IDLE : state), [key, state]);
}
