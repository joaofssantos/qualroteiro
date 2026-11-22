/**
 * `usePlanPreview`: a prévia do traçado (F9). `planRoute` é simulado e o tempo é falso:
 * nada aqui toca a rede nem espera de verdade.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, planRoute } from '@/core/api/client';
import type { PlannedRoute, PlaceInput } from '@/core/api/types';
import { useMapStore } from '@/core/map/mapStore';
import { useRouteStore } from '@/core/store/routeStore';

import { DEFAULT_VEHICLE } from './routeDraftStore';
import { clearPreviewCache, previewKey, usePlanPreview, type PlanPreviewInput } from './usePlanPreview';

vi.mock('@/core/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/core/api/client')>()),
  planRoute: vi.fn(),
}));

const planRouteMock = vi.mocked(planRoute);

const SP: PlaceInput = { lng: -46.63331, lat: -23.55052 };
const RJ: PlaceInput = { lng: -43.17229, lat: -22.90685 };
const BH: PlaceInput = { lng: -43.93778, lat: -19.92083 };

function route(distanceKm = 412, durationMin = 310): PlannedRoute {
  return {
    geometry: {
      type: 'LineString',
      coordinates: [
        [-46.63, -23.55],
        [-43.17, -22.9],
      ],
    },
    distanceKm,
    durationMin,
  } as unknown as PlannedRoute;
}

function input(over: Partial<PlanPreviewInput> = {}): PlanPreviewInput {
  return {
    origin: SP,
    destination: RJ,
    stops: [],
    vehicle: DEFAULT_VEHICLE,
    enabled: true,
    ...over,
  };
}

/** Cada chamada ganha uma promessa pendente que o teste resolve/rejeita à mão. */
function pendingCalls() {
  const calls: {
    signal: AbortSignal | undefined;
    resolve(routes?: readonly PlannedRoute[]): void;
    reject(error: unknown): void;
  }[] = [];
  planRouteMock.mockImplementation(
    (_request, signal) =>
      new Promise((resolve, reject) => {
        calls.push({ signal, resolve: (routes = [route()]) => resolve(routes), reject });
      }),
  );
  return calls;
}

async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function setup(initial: PlanPreviewInput) {
  return renderHook((props: PlanPreviewInput) => usePlanPreview(props), { initialProps: initial });
}

beforeEach(() => {
  vi.useFakeTimers();
  planRouteMock.mockReset();
  clearPreviewCache();
  useMapStore.getState().clearMap();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('previewKey', () => {
  it('é null sem coordenadas nos dois extremos e arredonda a 5 casas', () => {
    expect(previewKey(input({ origin: null }))).toBeNull();
    expect(previewKey(input({ origin: 'São Paulo' }))).toBeNull();
    expect(previewKey(input({ stops: ['Campinas'] }))).toBeNull();
    const a = previewKey(input({ origin: { lng: -46.6333101, lat: -23.5505201 } }));
    expect(a).toBe(previewKey(input()));
  });

  it('muda com veículo, preço, parada e sentido', () => {
    const base = previewKey(input());
    expect(previewKey(input({ vehicle: { ...DEFAULT_VEHICLE, consumptionKmPerL: 12 } }))).not.toBe(base);
    expect(previewKey(input({ vehicle: { ...DEFAULT_VEHICLE, fuelPricePerL: 7 } }))).not.toBe(base);
    expect(previewKey(input({ vehicle: { ...DEFAULT_VEHICLE, axleCategory: 'truck-2' as never } }))).not.toBe(base);
    expect(previewKey(input({ stops: [BH] }))).not.toBe(base);
    expect(previewKey(input({ origin: RJ, destination: SP }))).not.toBe(base);
  });
});

describe('usePlanPreview', () => {
  it('(a,b) só origem, ou texto livre nos dois: nenhuma chamada', async () => {
    const calls = pendingCalls();
    const { result, rerender } = setup(input({ destination: null }));
    await tick(2000);
    rerender(input({ origin: 'São Paulo', destination: 'Rio' }));
    await tick(2000);
    expect(calls).toHaveLength(0);
    expect(result.current).toEqual({ status: 'idle', summary: null });
  });

  it('(c) dois pontos com coordenadas: 1 chamada só aos 700 ms, com o request completo', async () => {
    const calls = pendingCalls();
    const { result } = setup(input({ stops: [BH] }));
    await tick(699);
    expect(calls).toHaveLength(0);
    await tick(1);
    expect(calls).toHaveLength(1);
    expect(result.current.status).toBe('loading');
    expect(planRouteMock.mock.calls[0]?.[0]).toEqual({
      origin: SP,
      destination: RJ,
      waypoints: [BH],
      vehicle: {
        type: DEFAULT_VEHICLE.type,
        axleCategory: DEFAULT_VEHICLE.axleCategory,
        consumptionKmPerL: DEFAULT_VEHICLE.consumptionKmPerL,
      },
      fuelPricePerL: DEFAULT_VEHICLE.fuelPricePerL,
    });

    await act(async () => calls[0]?.resolve());
    expect(result.current).toEqual({ status: 'ready', summary: { km: 412, minutes: 310 } });
    expect(useMapStore.getState().preview?.coordinates).toHaveLength(2);
  });

  it('(d) mudar o destino com a chamada em voo a aborta; só a última segue', async () => {
    const calls = pendingCalls();
    const { rerender } = setup(input());
    await tick(700);
    expect(calls).toHaveLength(1);

    rerender(input({ destination: BH }));
    await tick(0);
    expect(calls[0]?.signal?.aborted).toBe(true);
    await tick(300);
    rerender(input({ destination: { lng: -49.2, lat: -25.4 } }));
    await tick(700);
    expect(calls).toHaveLength(2);
    expect(calls[1]?.signal?.aborted).toBe(false);
  });

  it('(e) voltar ao mesmo par — mesmo após remontar — reaproveita o cache', async () => {
    const calls = pendingCalls();
    const first = setup(input());
    await tick(700);
    await act(async () => calls[0]?.resolve());
    first.unmount();

    const second = setup(input());
    await tick(1000);
    expect(calls).toHaveLength(1);
    expect(second.result.current.status).toBe('ready');
    expect(useMapStore.getState().preview).not.toBeNull();
  });

  it('(e) remontar com a chamada ainda em voo não duplica a requisição', async () => {
    const calls = pendingCalls();
    const first = setup(input());
    await tick(700);
    // A troca A↔B desmonta/remonta o consumidor, mas a consulta continua sendo K.
    // A promessa de K deve sobreviver à troca e publicar a resposta da chamada original.
    first.unmount();
    const second = setup(input());
    expect(calls[0]?.signal?.aborted).toBe(false);
    await tick(700);
    expect(calls).toHaveLength(1);

    await act(async () => calls[0]?.resolve());
    expect(second.result.current).toEqual({ status: 'ready', summary: { km: 412, minutes: 310 } });
    expect(useMapStore.getState().preview?.coordinates).toHaveLength(2);
  });

  it('(e) voltar a K antes de resolver reaproveita a promessa em voo e não deixa resposta antiga sobrescrever', async () => {
    const calls = pendingCalls();
    const { result, rerender } = setup(input());
    await tick(700);
    expect(calls).toHaveLength(1);

    rerender(input({ destination: BH }));
    rerender(input());
    expect(calls[0]?.signal?.aborted).toBe(false);
    await tick(700);
    expect(calls).toHaveLength(1);

    await act(async () => calls[0]?.resolve([route(500, 400)]));
    expect(result.current).toEqual({ status: 'ready', summary: { km: 500, minutes: 400 } });
    expect(useMapStore.getState().preview?.coordinates).toHaveLength(2);
  });

  it('(g) apagar um ponto limpa a prévia e não chama', async () => {
    const calls = pendingCalls();
    const { result, rerender } = setup(input());
    await tick(700);
    await act(async () => calls[0]?.resolve());
    expect(useMapStore.getState().preview).not.toBeNull();

    rerender(input({ destination: null }));
    expect(useMapStore.getState().preview).toBeNull();
    expect(result.current).toEqual({ status: 'idle', summary: null });
    await tick(2000);
    expect(calls).toHaveLength(1);
  });

  it.each([
    ['AbortError', new DOMException('aborted', 'AbortError')],
    ['422', new ApiError('unresolved-place', 422, 'origin não encontrada')],
    ['429', new ApiError('server', 429, 'Muitas requisições')],
    ['rede', new ApiError('network', 0, 'offline')],
  ])('(h) %s: status error, sem lançar, prévia nula e sem nova tentativa', async (_name, error) => {
    const calls = pendingCalls();
    const { result } = setup(input());
    await tick(700);
    await act(async () => calls[0]?.reject(error));
    expect(result.current).toEqual({ status: 'error', summary: null });
    expect(useMapStore.getState().preview).toBeNull();
    await tick(10_000);
    expect(calls).toHaveLength(1);
  });

  it('(h) resposta sem alternativas também some em silêncio', async () => {
    const calls = pendingCalls();
    const { result } = setup(input());
    await tick(700);
    await act(async () => calls[0]?.resolve([]));
    expect(result.current.status).toBe('error');
    expect(useMapStore.getState().preview).toBeNull();
  });

  it('(i) desmontar aborta a chamada e limpa a prévia', async () => {
    const calls = pendingCalls();
    const { unmount } = setup(input());
    await tick(700);
    unmount();
    await tick(0);
    expect(calls[0]?.signal?.aborted).toBe(true);
    expect(useMapStore.getState().preview).toBeNull();
  });

  it('(j) enabled=false: nada', async () => {
    const calls = pendingCalls();
    const { result } = setup(input({ enabled: false }));
    await tick(5000);
    expect(calls).toHaveLength(0);
    expect(result.current.status).toBe('idle');
  });

  it('(k) escolher origem, destino e trocar o destino 2× faz no máximo 2 chamadas', async () => {
    const calls = pendingCalls();
    const { rerender } = setup(input({ origin: null, destination: null }));
    rerender(input({ destination: null }));
    await tick(200);
    rerender(input()); // origem + destino
    await tick(700); // chamada 1
    rerender(input({ destination: BH })); // troca 1
    await tick(300);
    rerender(input({ destination: { lng: -49.2, lat: -25.4 } })); // troca 2, ainda no debounce
    await tick(700); // chamada 2
    await act(async () => calls[1]?.resolve());
    await tick(5000);
    expect(calls.length).toBeLessThanOrEqual(2);
    console.info(`[F9] contagem de chamadas no fluxo típico: ${calls.length}`);
  });

  it('não grava em routeStore.routes', async () => {
    const calls = pendingCalls();
    const before = useRouteStore.getState().routes;
    setup(input());
    await tick(700);
    await act(async () => calls[0]?.resolve());
    expect(useRouteStore.getState().routes).toBe(before);
  });
});
