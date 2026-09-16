import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { restaurantesModule } from '.';

vi.mock('@/core/auth/AuthContext', () => ({
  useQualAuth: vi.fn(() => ({
    isConfigured: true,
    isLoaded: true,
    isSignedIn: false,
    userName: null,
    getToken: vi.fn(async () => null),
  })),
}));

describe('restaurantes module', () => {
  it('calculates the total cost live without submitting to the network', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const user = userEvent.setup();
    const Panel = restaurantesModule.Panel;

    render(
      <MemoryRouter>
        <Panel />
      </MemoryRouter>,
    );

    await user.clear(screen.getByLabelText('Preço por pessoa'));
    await user.type(screen.getByLabelText('Preço por pessoa'), '50');
    await user.clear(screen.getByLabelText('Pessoas'));
    await user.type(screen.getByLabelText('Pessoas'), '4');

    expect(screen.getByText('R$ 200,00')).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
