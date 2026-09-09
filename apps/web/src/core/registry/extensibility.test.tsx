/**
 * The extensibility proof.
 *
 * The whole point of this wave is that a *later* module — "planejamento de
 * viagem", "roteiro", "frete" — can be added without touching the core. This test
 * is what makes that claim falsifiable rather than aspirational.
 *
 * The fake module below is declared **entirely inside this file**. Nothing in
 * `src/core/**`, `src/App.tsx` or `src/modules/**` knows it exists. If the shell
 * ever grew a hard-coded list of modules, or the router stopped deriving its
 * routes from the registry, these assertions would fail.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { AppRouter } from '../shell/AppRouter';
import { listModules, registerModule, resetRegistry } from './registry';
import type { ModuleDefinition } from './types';

/** A module a future developer might write. One object, no core changes. */
const demoModule: ModuleDefinition = {
  id: 'demo',
  label: 'Demo',
  path: '/demo',
  Panel: function DemoPanel() {
    return <h1>Painel do módulo Demo</h1>;
  },
};

afterEach(() => {
  resetRegistry();
});

describe('module registry', () => {
  it('adds a module to the shell nav and routes to it, with no core edit', async () => {
    registerModule(demoModule);

    render(
      <MemoryRouter initialEntries={['/demo']}>
        <AppRouter />
      </MemoryRouter>,
    );

    // The nav is generated from the registry.
    expect(screen.getByRole('link', { name: 'Demo' })).toBeInTheDocument();
    // And the route renders the module's own panel.
    expect(screen.getByRole('heading', { name: 'Painel do módulo Demo' })).toBeInTheDocument();
  });

  it('navigates to a registered module from the nav', async () => {
    const user = userEvent.setup();
    registerModule(demoModule);
    registerModule({
      id: 'outro',
      label: 'Outro',
      path: '/outro',
      Panel: () => <h1>Painel do módulo Outro</h1>,
    });

    render(
      <MemoryRouter initialEntries={['/demo']}>
        <AppRouter />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('link', { name: 'Outro' }));

    expect(screen.getByRole('heading', { name: 'Painel do módulo Outro' })).toBeInTheDocument();
  });

  it('redirects the root path to the first registered module', () => {
    registerModule(demoModule);

    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRouter />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Painel do módulo Demo' })).toBeInTheDocument();
  });

  it('is idempotent per id, so a double registration does not duplicate the nav', () => {
    registerModule(demoModule);
    registerModule(demoModule);

    expect(listModules().filter((m) => m.id === 'demo')).toHaveLength(1);
  });

  it('preserves registration order', () => {
    registerModule(demoModule);
    registerModule({ id: 'b', label: 'B', path: '/b', Panel: () => null });

    expect(listModules().map((m) => m.id)).toEqual(['demo', 'b']);
  });

  it('lets a module own nested routes under its path', () => {
    registerModule({
      id: 'nested',
      label: 'Nested',
      path: '/nested',
      Panel: () => <h1>Sub-rota do módulo</h1>,
    });

    render(
      <MemoryRouter initialEntries={['/nested/alguma/coisa']}>
        <AppRouter />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Sub-rota do módulo' })).toBeInTheDocument();
  });
});
