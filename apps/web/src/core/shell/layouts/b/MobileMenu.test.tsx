import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useLayoutStore } from '@/core/layout/layoutStore';
import { resetApp } from '@/test/renderApp';
import { registerAppModules } from '@/modules';

import { ShellB } from './ShellB';

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

beforeEach(() => {
  window.localStorage.clear();
  resetApp();
  registerAppModules();
  useLayoutStore.setState({ layout: 'b' });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  resetApp();
});

function renderShell() {
  return render(
    <MemoryRouter initialEntries={['/hospedagem']}>
      <ShellB>
        <p>conteúdo</p>
      </ShellB>
    </MemoryRouter>,
  );
}

describe('Navegação mobile do layout B (390 px)', () => {
  it('abre o Menu por botão, lista os 5 módulos com nomes únicos, Esc fecha e devolve o foco', async () => {
    mobileViewport(true);
    const user = userEvent.setup();
    renderShell();

    // Fechado: nenhum link de módulo no DOM (sem duplicar nomes).
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    const menu = screen.getByRole('button', { name: 'Menu' });
    expect(menu).toHaveAttribute('aria-expanded', 'false');

    await user.click(menu);
    const dialog = screen.getByRole('dialog', { name: 'Menu' });
    const links = within(dialog).getAllByRole('link');
    expect(links).toHaveLength(5);
    const names = links.map((l) => l.textContent);
    expect(new Set(names).size).toBe(5);
    expect(screen.getAllByRole('link')).toHaveLength(5);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument();
    expect(menu).toHaveFocus();
  });

  it('escolher um módulo navega e fecha o menu', async () => {
    mobileViewport(true);
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.click(screen.getByRole('link', { name: /Restaurantes/ }));

    expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument();
  });

  it('Ajustes continua alcançável no mobile e troca o layout para A', async () => {
    mobileViewport(true);
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole('button', { name: 'Ajustes' }));
    await user.click(screen.getByRole('radio', { name: /Mapa primeiro/ }));

    expect(useLayoutStore.getState().layout).toBe('a');
  });

  it('no desktop os módulos ficam na barra superior e não há botão Menu', () => {
    mobileViewport(false);
    renderShell();

    expect(screen.queryByRole('button', { name: 'Menu' })).not.toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Módulos' });
    expect(within(nav).getAllByRole('link')).toHaveLength(5);
  });
});
