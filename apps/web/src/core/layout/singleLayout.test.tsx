/**
 * Receita de remoção (spec §4.3): com UM só shell registrado, o app renderiza o
 * sobrevivente e os Ajustes escondem o grupo de layout. Aqui o registro vem de
 * `LAYOUT_META`, reduzido a uma entrada — exatamente o que sobra depois de
 * apagar `core/shell/layouts/b/` e a linha `b` do registro.
 */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderApp, resetApp } from '@/test/renderApp';

import { SettingsDialog } from './SettingsDialog';
import { useLayoutStore } from './layoutStore';
import { LAYOUTS } from './layouts';

vi.mock('./layoutConfig', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./layoutConfig')>();
  // As funções do módulo original leem o `LAYOUT_META` original; refaz-as sobre o reduzido.
  const meta = { a: actual.LAYOUT_META.a };
  return {
    ...actual,
    LAYOUT_META: meta,
    registeredLayoutIds: () => ['a' as const],
    resolveLayoutId: () => 'a' as const,
  };
});

beforeEach(() => {
  window.localStorage.clear();
  resetApp();
});

afterEach(() => {
  cleanup();
  resetApp();
});

describe('registro com um único layout', () => {
  it('o registro tem só a entrada restante', () => {
    expect(Object.keys(LAYOUTS)).toEqual(['a']);
  });

  it('renderiza o shell restante mesmo com a escolha salva apontando para o layout removido', async () => {
    useLayoutStore.setState({ layout: 'b' });
    renderApp('/rota-custos');

    expect(await screen.findByRole('navigation', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Calcular/ })).not.toBeNull();
  });

  it('Ajustes esconde o grupo de layout', async () => {
    const user = userEvent.setup();
    render(<SettingsDialog />);

    await user.click(screen.getByRole('button', { name: 'Ajustes' }));
    expect(await screen.findByRole('dialog', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: 'Layout' })).toBeNull();
    expect(screen.queryByRole('radio', { name: /Custos primeiro/ })).toBeNull();
  });
});
