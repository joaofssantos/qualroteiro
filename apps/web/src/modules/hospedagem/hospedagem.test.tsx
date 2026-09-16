import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { mockApi, renderApp, resetApp } from '@/test/renderApp';

afterEach(() => {
  vi.unstubAllGlobals();
  resetApp();
});

describe('Hospedagem module', () => {
  it('appears in the generated nav and calculates live without network', async () => {
    const user = userEvent.setup();
    const fetchSpy = mockApi();

    renderApp('/hospedagem');

    expect(screen.getByRole('link', { name: 'Hospedagem' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hospedagem' })).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('R$ 640,00')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Check-out'));
    await user.type(screen.getByLabelText('Check-out'), '2026-10-06');
    await user.clear(screen.getByLabelText('Preço/noite'));
    await user.type(screen.getByLabelText('Preço/noite'), '150');

    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('R$ 750,00')).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
