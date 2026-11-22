import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PlannedRoute } from '@/core/api/types';
import { AuthContext, missingAuth } from '@/core/auth/AuthContext';
import { useRouteStore } from '@/core/store/routeStore';
import { ALTERNATIVE_ROUTE, DUTRA_ROUTE, PLAN_QUERY_FIXTURE } from '@/test/fixtures';
import { resetApp } from '@/test/renderApp';

import { ResultadoPage } from './ResultadoPage';

function mobileViewport(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('max-width') ? matches : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

function plan(routes: readonly PlannedRoute[]) {
  useRouteStore.setState({ query: PLAN_QUERY_FIXTURE, routes, activeIndex: 0, status: 'ready' });
}

function setup() {
  const onSelectPlaza = vi.fn();
  render(
    <AuthContext.Provider value={{ ...missingAuth, isSignedIn: true }}>
    <MemoryRouter initialEntries={['/rota-custos/resultado']}>
      <Routes>
        <Route path="/rota-custos" element={<p>consulta</p>} />
        <Route
          path="/rota-custos/resultado"
          element={<ResultadoPage onSelectPlaza={onSelectPlaza} />}
        />
      </Routes>
    </MemoryRouter>
    </AuthContext.Provider>,
  );
  return { onSelectPlaza };
}

beforeEach(() => {
  localStorage.clear();
  resetApp();
  mobileViewport(false);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  resetApp();
});

describe('ResultadoPage', () => {
  it('KPIs: total = combustível + pedágios; tabela com N linhas; clicar na 2ª troca activeIndex', async () => {
    plan([DUTRA_ROUTE, ALTERNATIVE_ROUTE]);
    const user = userEvent.setup();
    setup();

    // 257,82 + 52,90
    expect(within(screen.getByTestId('total-hero')).getByText('R$ 310,72')).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Comparação de alternativas' });
    expect(within(table).getAllByRole('row')).toHaveLength(3);

    await user.click(within(table).getAllByRole('row')[2]!);
    expect(useRouteStore.getState().activeIndex).toBe(1);
    expect(within(screen.getByTestId('total-hero')).getByText('R$ 325,84')).toBeInTheDocument();
  });

  it('o mapa único vem num cartão (MapCard) e as praças aparecem numeradas', () => {
    plan([DUTRA_ROUTE]);
    setup();

    expect(screen.getByTestId('map-card')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Praças de pedágio' })).toBeInTheDocument();
  });

  it('1 alternativa, sem praças e tarifa indisponível não quebram (Review Focus 5)', () => {
    const partial: PlannedRoute = {
      ...DUTRA_ROUTE,
      tolls: { plazas: [], total: 0, unavailablePlazaIds: ['p1'] },
      points: { tolls: [], fuelStations: [] },
    };
    plan([partial]);
    setup();

    expect(screen.getByText('Tarifa indisponível em 1 praça')).toBeInTheDocument();
    expect(screen.getByText('Custo total parcial')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(2);
  });

  it('sem resultado volta para a consulta', () => {
    setup();
    expect(screen.getByText('consulta')).toBeInTheDocument();
  });

  it('desktop: Salvar fica no cabeçalho; mobile: só na barra fixa inferior (sem nome duplicado)', () => {
    plan([DUTRA_ROUTE]);
    setup();
        expect(screen.getAllByRole('button', { name: /Salvar/ })).toHaveLength(1);
    expect(screen.queryByTestId('mobile-total-bar')).not.toBeInTheDocument();
    cleanup();

    mobileViewport(true);
    plan([DUTRA_ROUTE]);
    setup();
    const bar = screen.getByTestId('mobile-total-bar');
    expect(within(bar).getByText('R$ 310,72')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Salvar/ })).toHaveLength(1);
    expect(within(bar).getByRole('button', { name: /Salvar/ })).toBeInTheDocument();
  });
});
