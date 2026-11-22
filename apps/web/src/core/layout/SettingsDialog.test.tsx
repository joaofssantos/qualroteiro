import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SettingsDialog } from './SettingsDialog';
import { useLayoutStore } from './layoutStore';

beforeEach(() => {
  window.localStorage.clear();
  useLayoutStore.setState({ layout: 'a' });
});

afterEach(cleanup);

describe('SettingsDialog', () => {
  it('opens from the Ajustes button and switches the layout', async () => {
    const user = userEvent.setup();
    render(<SettingsDialog />);

    await user.click(screen.getByRole('button', { name: 'Ajustes' }));
    const custos = await screen.findByRole('radio', { name: /Custos primeiro/ }, { timeout: 3000 });
    expect(screen.getByRole('radio', { name: /Mapa primeiro/ })).toBeChecked();

    await user.click(custos);

    expect(useLayoutStore.getState().layout).toBe('b');
    expect(custos).toBeChecked();
  });

  it('keeps the choice after closing', async () => {
    const user = userEvent.setup();
    useLayoutStore.setState({ layout: 'b' });
    render(<SettingsDialog />);

    await user.click(screen.getByRole('button', { name: 'Ajustes' }));
    await user.click(await screen.findByRole('button', { name: 'Fechar' }, { timeout: 3000 }));

    expect(useLayoutStore.getState().layout).toBe('b');
  });
});
