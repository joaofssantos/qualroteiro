import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useLayoutStore } from '@/core/layout/layoutStore';
import { useMapStore } from '@/core/map/mapStore';
import { useRouteStore } from '@/core/store/routeStore';
import { clearPreviewCache } from '../usePlanPreview';
import { DUTRA_ROUTE, RIO_DE_JANEIRO, SAO_PAULO } from '@/test/fixtures';
import { mockApi, resetApp } from '@/test/renderApp';

import { ConsultaHero } from './ConsultaHero';

async function pickPlace(user: ReturnType<typeof userEvent.setup>, label: string, typed: string, option: RegExp) {
  await user.type(screen.getByLabelText(label), typed);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(400);
  });
  await user.click(screen.getByRole('option', { name: option }));
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false });
  vi.stubGlobal('jest', { advanceTimersByTime: vi.advanceTimersByTime });
  localStorage.clear();
  resetApp();
  clearPreviewCache();
  useLayoutStore.setState({ layout: 'b' });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  resetApp();
});

function setup() {
  const user = userEvent.setup({ delay: null });
  render(
    <MemoryRouter>
      <ConsultaHero />
    </MemoryRouter>,
  );
  return user;
}

describe('ConsultaHero (mapa vivo)', () => {
  it('renderiza o formulário hero sobre o mapa, com o título da consulta', () => {
    mockApi();
    setup();

    expect(screen.getByRole('heading', { level: 1, name: 'Quanto custa essa viagem?' })).toBeInTheDocument();
    expect(screen.getByTestId('query-form')).toHaveAttribute('data-variant', 'hero');
    expect(screen.getByTestId('hero-map-slot')).toBeInTheDocument();
  });

  it('origem e destino com coordenadas → pinos, enquadramento e prévia ANTES de qualquer envio', async () => {
    const spy = mockApi({ places: [SAO_PAULO, RIO_DE_JANEIRO], routes: [DUTRA_ROUTE] });
    const user = setup();
    const fitBefore = useMapStore.getState().fitRequest;

    await pickPlace(user, 'Origem', 'São', /São Paulo/);
    await pickPlace(user, 'Destino', 'Rio', /Rio de Janeiro/);
    expect(useRouteStore.getState().endpointMarkers).toHaveLength(2);
    expect(useMapStore.getState().fitRequest).toBeGreaterThan(fitBefore);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });
    expect(useMapStore.getState().preview).not.toBeNull();
    expect(useRouteStore.getState().routes).toEqual([]);
    const planCalls = spy.mock.calls.filter(([url]) => String(url).startsWith('/api/routes/plan'));
    expect(planCalls).toHaveLength(1);
  });

  it('só um ponto (ou texto livre) não dispara prévia', async () => {
    const spy = mockApi({ places: [SAO_PAULO, RIO_DE_JANEIRO], routes: [DUTRA_ROUTE] });
    const user = setup();

    await pickPlace(user, 'Origem', 'São', /São Paulo/);
    await user.type(screen.getByLabelText('Destino'), 'Rio de Janeiro');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    const planCalls = spy.mock.calls.filter(([url]) => String(url).startsWith('/api/routes/plan'));
    expect(planCalls).toHaveLength(0);
    expect(useMapStore.getState().preview).toBeNull();
  });
});
