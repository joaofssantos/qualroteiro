import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useLayoutStore } from '@/core/layout/layoutStore';
import { renderApp, resetApp } from '@/test/renderApp';

import { THEME_STORAGE_KEY } from './useTheme';

let systemPrefersDark = false;

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.classList.remove('dark');
  systemPrefersDark = false;
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: systemPrefersDark,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
});

afterEach(() => {
  cleanup();
  resetApp();
  vi.unstubAllGlobals();
  document.documentElement.classList.remove('dark');
});

describe('AppShell (shells reais A e B)', () => {
  it.each(['a', 'b'] as const)(
    'layout %s: começa pelo esquema do sistema e persiste a escolha explícita de tema',
    async (layout) => {
      useLayoutStore.setState({ layout });
      systemPrefersDark = true;
      const user = userEvent.setup();
      renderApp('/hospedagem');

      expect(document.documentElement).toHaveClass('dark');

      const toLight = (await screen.findAllByRole('button', { name: 'Alternar para tema claro' }))[0]!;
      await user.click(toLight);

      expect(document.documentElement).not.toHaveClass('dark');
      expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
      expect(
        screen.getAllByRole('button', { name: 'Alternar para tema escuro' }).length,
      ).toBeGreaterThan(0);
    },
  );

  it.each(['a', 'b'] as const)(
    'layout %s: mostra a navegação dos módulos registrados',
    async (layout) => {
      useLayoutStore.setState({ layout });
      renderApp('/hospedagem');

      const links = await screen.findAllByRole('link', { name: /Hospedagem/ });
      expect(links.length).toBeGreaterThan(0);
    },
  );

  it.each([
    ['a', 'b'],
    ['b', 'a'],
  ] as const)(
    'devolve o foco ao gatilho de Ajustes do novo shell ao trocar o layout %s→%s (não ao body)',
    async (from, to) => {
      useLayoutStore.setState({ layout: from });
      const user = userEvent.setup();
      renderApp('/rota-custos');

      const trigger = (await screen.findAllByRole('button', { name: 'Ajustes' }))[0]!;
      await user.click(trigger);
      const option = await screen.findByRole('radio', { name: to === 'b' ? /Custos primeiro/ : /Mapa primeiro/ });
      await user.click(option);

      expect(useLayoutStore.getState().layout).toBe(to);
      await vi.waitFor(() => {
        expect(document.activeElement).not.toBe(document.body);
        expect(document.activeElement).toHaveAccessibleName('Ajustes');
      });
    },
  );
});
