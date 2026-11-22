import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Map as MapIcon } from 'lucide-react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useMapStore } from '@/core/map/mapStore';
import { registerModule, resetRegistry } from '@/core/registry/registry';
import { renderApp, resetApp } from '@/test/renderApp';

import { PANEL_STORAGE_KEY, PANEL_WIDTH, RAIL_WIDTH, ShellA } from './ShellA';

const Dummy = () => <p>conteúdo</p>;

function registerFakes() {
  registerModule({ id: 'um', label: 'Módulo Um', path: '/um', Panel: Dummy, icon: MapIcon, showMap: true });
  registerModule({ id: 'dois', label: 'Módulo Dois', path: '/dois', Panel: Dummy, icon: MapIcon, showMap: true });
  registerModule({ id: 'sem', label: 'Sem Mapa', path: '/sem', Panel: Dummy, icon: MapIcon });
}

function renderShell(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ShellA>
        <p>filho</p>
      </ShellA>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  resetRegistry();
  useMapStore.getState().clearMap();
  registerFakes();
});

afterEach(() => {
  cleanup();
  resetRegistry();
  useMapStore.getState().clearMap();
});

describe('ShellA (desktop)', () => {
  it('has exactly one link per module in the rail', () => {
    renderShell('/um');
    const nav = screen.getByRole('navigation', { name: 'Módulos' });

    for (const name of ['Módulo Um', 'Módulo Dois', 'Sem Mapa']) {
      expect(within(nav).getAllByRole('link', { name })).toHaveLength(1);
    }
    expect(screen.getAllByRole('link', { name: 'Módulo Um' })).toHaveLength(1);
  });

  it('collapses the panel, persists the choice and publishes the map padding', async () => {
    const user = userEvent.setup();
    renderShell('/um');

    const toggle = screen.getByRole('button', { name: /painel/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(useMapStore.getState().padding.left).toBe(RAIL_WIDTH + PANEL_WIDTH + 16);

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(window.localStorage.getItem(PANEL_STORAGE_KEY)).toBe('true');
    expect(useMapStore.getState().padding.left).toBe(RAIL_WIDTH);

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(useMapStore.getState().padding.left).toBe(RAIL_WIDTH + PANEL_WIDTH + 16);
  });

  it('starts collapsed when the stored preference says so', () => {
    window.localStorage.setItem(PANEL_STORAGE_KEY, 'true');
    renderShell('/um');

    expect(screen.getByRole('button', { name: /painel/i })).toHaveAttribute('aria-expanded', 'false');
    expect(useMapStore.getState().padding.left).toBe(RAIL_WIDTH);
  });

  it('re-publishes the padding when a module clears the map store on unmount', () => {
    renderShell('/um');
    useMapStore.getState().clearMap();

    expect(useMapStore.getState().padding.left).toBe(RAIL_WIDTH + PANEL_WIDTH + 16);
  });

  it('renders a module without a map at full width, with no map slot and no padding', () => {
    renderShell('/sem');

    expect(screen.queryByTestId('app-map-container')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /painel/i })).not.toBeInTheDocument();
    expect(screen.getByText('filho')).toBeInTheDocument();
    expect(useMapStore.getState().padding.left).toBe(0);
  });

  it('puts the map behind the panel for a module with a map', () => {
    renderShell('/um');

    expect(screen.getByTestId('app-map-container')).toBeInTheDocument();
    expect(screen.getByTestId('floating-panel')).toHaveTextContent('filho');
  });

  it('keeps the layout CSS free of !important', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');
    const block = css.slice(css.indexOf('.floating-panel'));

    expect(css).toContain('.floating-panel');
    expect(block).not.toContain('!important');
  });
});

describe('ShellA with the real app', () => {
  it('renders the real modules through the A shell with one link each', () => {
    cleanup();
    resetRegistry();
    renderApp('/hospedagem');

    expect(screen.getByTestId('floating-panel')).toBeInTheDocument();
    for (const name of ['Rota & Custos', 'Planejamento', 'Hospedagem', 'Restaurantes', 'Atividades']) {
      expect(screen.getAllByRole('link', { name })).toHaveLength(1);
    }
    resetApp();
  });
});
