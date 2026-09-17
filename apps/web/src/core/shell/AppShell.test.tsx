import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderApp, resetApp } from '@/test/renderApp';

import { SIDEBAR_STORAGE_KEY } from './AppShell';
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

describe('AppShell', () => {
  it('starts from the system colour scheme and persists an explicit theme choice', async () => {
    systemPrefersDark = true;
    const user = userEvent.setup();
    renderApp('/hospedagem');

    expect(document.documentElement).toHaveClass('dark');

    await user.click(screen.getByRole('button', { name: 'Alternar para tema claro' }));

    expect(document.documentElement).not.toHaveClass('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(screen.getByRole('button', { name: 'Alternar para tema escuro' })).toBeInTheDocument();
  });

  it('minimizes the desktop menu while keeping icon-only module links named', async () => {
    const user = userEvent.setup();
    renderApp('/hospedagem');

    await user.click(screen.getByRole('button', { name: 'Minimizar menu lateral' }));

    expect(screen.getByRole('navigation', { name: 'Módulos' })).toHaveClass('md:w-16');
    expect(screen.getByRole('button', { name: 'Expandir menu lateral' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Hospedagem' })).toHaveAttribute('title', 'Hospedagem');
    expect(window.localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('true');
  });

  it.each(['/rota-custos', '/hospedagem', '/restaurantes', '/atividades'])(
    'stacks the map above the content for %s',
    (path) => {
      const { container } = renderApp(path);
      const main = container.querySelector('main');
      const map = screen.getByTestId('app-map-container');

      expect(main).toHaveClass('flex-col');
      expect(main).not.toHaveClass('md:flex-row');
      expect(map).toHaveClass('h-[30vh]', 'min-h-48', 'max-h-[22rem]');
      expect(map.parentElement).toBe(main);
      expect(map.nextElementSibling).toHaveClass('overflow-y-auto');

      cleanup();
      resetApp();
    },
  );
});
