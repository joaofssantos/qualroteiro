import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Place } from '../api/types';
import { PlaceSearch, type PlaceFieldValue } from './PlaceSearch';

const SAO_PAULO: Place = {
  id: 'sp',
  label: 'São Paulo, SP, Brasil',
  lng: -46.6333,
  lat: -23.5505,
};
const SANTOS: Place = { id: 'santos', label: 'Santos, SP, Brasil', lng: -46.3336, lat: -23.9608 };

function mockSearch(places: readonly Place[] = [SAO_PAULO, SANTOS]) {
  const spy = vi.fn(async (input: RequestInfo | URL) => {
    void input;
    return new Response(JSON.stringify({ places }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', spy);
  return spy;
}

/** Render with controlled state, the way the form uses it. */
function Harness({ onChange }: { onChange?: (value: PlaceFieldValue) => void } = {}) {
  const [value, setValue] = useState<PlaceFieldValue>({ text: '', place: null });
  return (
    <PlaceSearch
      id="origin"
      label="Origem"
      value={value}
      onChange={(next: PlaceFieldValue) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('PlaceSearch', () => {
  it('debounces: typing several characters issues one search, not one per keystroke', async () => {
    const fetchSpy = mockSearch();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<Harness />);
    await user.type(screen.getByLabelText('Origem'), 'São Pau');

    // Before the debounce window elapses, nothing has been requested.
    expect(fetchSpy).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(400);

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(
      `/api/places/search?q=${encodeURIComponent('São Pau')}`,
    );
  });

  it('offers the hits and sets the field to the one the user picks', async () => {
    mockSearch();
    const onChange = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<Harness onChange={onChange} />);
    await user.type(screen.getByLabelText('Origem'), 'São');
    await vi.advanceTimersByTimeAsync(400);

    const option = await screen.findByRole('option', { name: /São Paulo, SP/ });
    await user.click(option);

    expect(screen.getByLabelText('Origem')).toHaveValue('São Paulo, SP, Brasil');
    expect(onChange).toHaveBeenLastCalledWith({
      text: 'São Paulo, SP, Brasil',
      place: SAO_PAULO,
    });
  });

  it('does not search for a query shorter than the minimum', async () => {
    const fetchSpy = mockSearch();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<Harness />);
    await user.type(screen.getByLabelText('Origem'), 'a');
    await vi.advanceTimersByTimeAsync(400);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reports an empty result rather than showing nothing at all', async () => {
    mockSearch([]);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<Harness />);
    await user.type(screen.getByLabelText('Origem'), 'zzzz');
    await vi.advanceTimersByTimeAsync(400);

    expect(await screen.findByText(/nenhum lugar encontrado/i)).toBeInTheDocument();
  });

  it('surfaces a field error and marks the input invalid', async () => {
    render(
      <PlaceSearch
        id="destination"
        label="Destino"
        value={{ text: 'Rio de Janiro', place: null }}
        onChange={() => {}}
        error="Endereço não encontrado."
      />,
    );

    const input = screen.getByLabelText('Destino');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Endereço não encontrado.')).toBeInTheDocument();
  });
});
