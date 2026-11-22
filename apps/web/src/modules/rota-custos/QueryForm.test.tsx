/**
 * `QueryForm` isolado: o formulário compartilhado pelos shells, sem router nem
 * mapa — só os stores e a rede simulada.
 */

import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DUTRA_ROUTE, RIO_DE_JANEIRO, SAO_PAULO } from '@/test/fixtures';
import { useLayoutStore } from '@/core/layout/layoutStore';
import { useMapStore } from '@/core/map/mapStore';
import { clearPreviewCache } from './usePlanPreview';
import { mockApi, resetApp } from '@/test/renderApp';
import { useRouteStore } from '@/core/store/routeStore';

import { QueryForm, type QueryFormEndpoints } from './QueryForm';
import { useRouteDraftStore } from './routeDraftStore';

function setup(props: { variant?: 'panel' | 'hero' } = {}) {
  const onSubmitted = vi.fn();
  const onEndpointsChange = vi.fn<(e: QueryFormEndpoints) => void>();
  const user = userEvent.setup({ delay: null });
  render(
    <QueryForm
      variant={props.variant ?? 'panel'}
      onSubmitted={onSubmitted}
      onEndpointsChange={onEndpointsChange}
    />,
  );
  return { user, onSubmitted, onEndpointsChange };
}

/** Digita, deixa passar o debounce do autocomplete e escolhe a opção. */
async function pickPlace(user: ReturnType<typeof userEvent.setup>, label: string, typed: string, option: RegExp) {
  await user.type(screen.getByLabelText(label), typed);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(400);
  });
  await user.click(screen.getByRole('option', { name: option }));
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false });
  // O asyncWrapper do RTL só drena timers falsos se enxergar `jest`; sem isto
  // qualquer `user.*` fica preso num setTimeout(0) que nunca dispara.
  vi.stubGlobal('jest', { advanceTimersByTime: vi.advanceTimersByTime });
  localStorage.clear();
  resetApp();
  clearPreviewCache();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  resetApp();
});

describe('QueryForm', () => {
  it('expõe o veículo como radiogroup "Veículo" com 4 opções e grava o perfil no rascunho', async () => {
    mockApi();
    const { user } = setup();

    const group = screen.getByRole('radiogroup', { name: 'Veículo' });
    const names = within(group)
      .getAllByRole('radio')
      .map((radio) => radio.getAttribute('aria-label') ?? radio.textContent);
    expect(names).toEqual(['Carro', 'Moto', 'Caminhão', 'Reboque']);
    expect(within(group).getByRole('radio', { name: 'Carro' })).toBeChecked();

    await user.click(within(group).getByRole('radio', { name: 'Caminhão' }));
    expect(within(group).getByRole('radio', { name: 'Caminhão' })).toBeChecked();
    expect(useRouteDraftStore.getState().vehicle).toMatchObject({
      type: 'truck',
      axleCategory: 'truck_2_axle',
    });
  });

  it('guarda a categoria de pedágio em "Opções de trajeto" (accordion fechado por padrão)', async () => {
    mockApi();
    const { user } = setup();

    const trigger = screen.getByRole('button', { name: 'Opções de trajeto' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText('Categoria de pedágio')).not.toBeInTheDocument();

    await user.click(trigger);
    await user.selectOptions(screen.getByLabelText('Categoria de pedágio'), 'truck_5_axle');
    expect(useRouteDraftStore.getState().vehicle.axleCategory).toBe('truck_5_axle');
    // consumo e preço continuam visíveis fora do accordion
    expect(screen.getByLabelText('Consumo (km/l)')).toBeInTheDocument();
    expect(screen.getByLabelText('Preço do combustível (R$/l)')).toBeInTheDocument();
  });

  it('inverter troca origem e destino no formulário, no rascunho e nos marcadores', async () => {
    mockApi({ places: [SAO_PAULO, RIO_DE_JANEIRO] });
    const { user } = setup();

    await pickPlace(user, 'Origem', 'São', /São Paulo/);
    await pickPlace(user, 'Destino', 'Rio', /Rio de Janeiro/);
    await user.click(screen.getByRole('button', { name: 'Inverter origem e destino' }));

    expect(screen.getByLabelText('Origem')).toHaveValue(RIO_DE_JANEIRO.label);
    expect(screen.getByLabelText('Destino')).toHaveValue(SAO_PAULO.label);
    expect(useRouteDraftStore.getState().origin.place?.id).toBe(RIO_DE_JANEIRO.id);
    const labels = useRouteStore.getState().endpointMarkers.map((m) => m.label);
    expect(labels).toEqual([`Origem: ${RIO_DE_JANEIRO.label}`, `Destino: ${SAO_PAULO.label}`]);
  });

  it('fixa o 422 no campo que a API nomeou e não chama onSubmitted', async () => {
    mockApi({
      planResponse: () =>
        new Response(JSON.stringify({ error: "destination: no place found for 'Rio de Janiro'" }), {
          status: 422,
          headers: { 'content-type': 'application/json' },
        }),
    });
    const { user, onSubmitted } = setup();

    await user.type(screen.getByLabelText('Origem'), 'São Paulo, SP');
    await user.type(screen.getByLabelText('Destino'), 'Rio de Janiro, RJ');
    await user.click(screen.getByRole('button', { name: /calcular rota/i }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    // O RTL não enxerga timers falsos do vitest: findBy/waitFor ficam de fora aqui.
    const destination = screen.getByLabelText('Destino');
    expect(destination).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Origem')).not.toHaveAttribute('aria-invalid', 'true');
    expect(onSubmitted).not.toHaveBeenCalled();
  });

  it('chama onSubmitted uma vez quando o plano volta e limpa o rascunho', async () => {
    mockApi({ routes: [(await import('@/test/fixtures')).DUTRA_ROUTE] });
    const { user, onSubmitted } = setup();

    await user.type(screen.getByLabelText('Origem'), 'São Paulo, SP');
    await user.type(screen.getByLabelText('Destino'), 'Rio de Janeiro, RJ');
    await user.click(screen.getByRole('button', { name: /calcular rota/i }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(onSubmitted).toHaveBeenCalledTimes(1);
    expect(useRouteDraftStore.getState().origin.text).toBe('');
  });

  it('onEndpointsChange recebe o lugar escolhido (com coordenadas)', async () => {
    mockApi({ places: [SAO_PAULO] });
    const { user, onEndpointsChange } = setup();

    await pickPlace(user, 'Origem', 'São', /São Paulo/);

    const last = onEndpointsChange.mock.calls.at(-1)![0];
    expect(last.origin.place).toMatchObject({ id: SAO_PAULO.id, lng: SAO_PAULO.lng, lat: SAO_PAULO.lat });
    expect(last.destination).toEqual({ text: '', place: null });
    expect(last.stops).toEqual([]);
    expect(last.vehicle).toMatchObject({ type: 'car' });
  });

  it('onEndpointsChange recebe texto livre sem coordenadas', async () => {
    mockApi();
    const { user, onEndpointsChange } = setup();

    await user.type(screen.getByLabelText('Destino'), 'Cam');

    const last = onEndpointsChange.mock.calls.at(-1)![0];
    expect(last.destination).toEqual({ text: 'Cam', place: null });
  });

  it('variant só muda a grade: mesmos campos nos dois', () => {
    mockApi();
    const { unmount } = render(<QueryForm variant="hero" onSubmitted={() => undefined} />);
    expect(screen.getByTestId('query-form')).toHaveAttribute('data-variant', 'hero');
    expect(screen.getByLabelText('Origem')).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Veículo' })).toBeInTheDocument();
    unmount();
    render(<QueryForm variant="panel" onSubmitted={() => undefined} />);
    expect(screen.getByTestId('query-form')).toHaveAttribute('data-variant', 'panel');
  });
});

describe('QueryForm — prévia do traçado (F9)', () => {
  const planCalls = (spy: ReturnType<typeof mockApi>) =>
    spy.mock.calls.filter(([url]) => String(url).startsWith('/api/routes/plan'));

  async function pickBoth(user: ReturnType<typeof userEvent.setup>) {
    await pickPlace(user, 'Origem', 'São', /São Paulo/);
    await pickPlace(user, 'Destino', 'Rio', /Rio de Janeiro/);
  }

  it('no layout B, origem e destino escolhidos desenham a prévia após 700 ms, sem tocar routeStore', async () => {
    const spy = mockApi({ places: [SAO_PAULO, RIO_DE_JANEIRO], routes: [DUTRA_ROUTE] });
    useLayoutStore.setState({ layout: 'b' });
    const { user } = setup();
    await pickBoth(user);

    expect(planCalls(spy)).toHaveLength(0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });
    expect(planCalls(spy)).toHaveLength(1);
    expect(useMapStore.getState().preview).not.toBeNull();
    expect(screen.getByText(/≈ .* km/)).toBeInTheDocument();
    expect(useRouteStore.getState().routes).toEqual([]);
    expect(useRouteStore.getState().status).toBe('idle');
  });

  it('no layout A não há prévia', async () => {
    const spy = mockApi({ places: [SAO_PAULO, RIO_DE_JANEIRO], routes: [DUTRA_ROUTE] });
    const { user } = setup();
    await pickBoth(user);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(planCalls(spy)).toHaveLength(0);
    expect(useMapStore.getState().preview).toBeNull();
  });

  it('VITE_LIVE_PREVIEW=false desliga a prévia mesmo no layout B', async () => {
    vi.stubEnv('VITE_LIVE_PREVIEW', 'false');
    const spy = mockApi({ places: [SAO_PAULO, RIO_DE_JANEIRO], routes: [DUTRA_ROUTE] });
    useLayoutStore.setState({ layout: 'b' });
    const { user } = setup();
    await pickBoth(user);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(planCalls(spy)).toHaveLength(0);
  });

  it('429 na prévia some em silêncio: sem alerta, sem erro no formulário', async () => {
    const spy = mockApi({
      places: [SAO_PAULO, RIO_DE_JANEIRO],
      planResponse: () => new Response('{}', { status: 429, headers: { 'retry-after': '30' } }),
    });
    useLayoutStore.setState({ layout: 'b' });
    const { user } = setup();
    await pickBoth(user);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(planCalls(spy)).toHaveLength(1);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(useMapStore.getState().preview).toBeNull();
  });
});
