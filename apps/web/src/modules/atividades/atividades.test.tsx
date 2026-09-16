import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { mockApi, renderApp, resetApp } from '@/test/renderApp';

afterEach(() => {
  vi.unstubAllGlobals();
  resetApp();
});

describe('Atividades module', () => {
  it('appears in the generated nav and calculates live without network', async () => {
    const user = userEvent.setup();
    const fetchSpy = mockApi();

    renderApp('/atividades');

    expect(screen.getByRole('link', { name: 'Atividades' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Atividades' })).toBeInTheDocument();
    expect(screen.getByText('R$ 300,00')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Preço/pessoa'));
    await user.type(screen.getByLabelText('Preço/pessoa'), '100');
    await user.clear(screen.getByLabelText('Nº de pessoas'));
    await user.type(screen.getByLabelText('Nº de pessoas'), '4');

    expect(screen.getByText('R$ 400,00')).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('shows a validation message instead of a total when the input is invalid', async () => {
    const user = userEvent.setup();
    mockApi();

    renderApp('/atividades');

    await user.clear(screen.getByLabelText('Nº de pessoas'));
    await user.type(screen.getByLabelText('Nº de pessoas'), '0');

    expect(screen.getByText('people must be at least 1')).toBeInTheDocument();
  });
});
