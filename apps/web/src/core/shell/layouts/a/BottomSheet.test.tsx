import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useMapStore } from '@/core/map/mapStore';

import { BottomSheet } from './BottomSheet';
import { type SheetSnap, sheetHeightFor } from './useSheetSnap';

function Harness({ initial = 'half' as SheetSnap }) {
  const [snap, setSnap] = useState<SheetSnap>(initial);
  return (
    <BottomSheet snap={snap} onSnapChange={setSnap} bottomOffset={56}>
      <label>
        Origem
        <input />
      </label>
    </BottomSheet>
  );
}

function fakeVisualViewport(height: number) {
  const listeners = new Set<() => void>();
  const vv = {
    height,
    width: 390,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  };
  Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
  return {
    resize(next: number) {
      vv.height = next;
      act(() => listeners.forEach((fn) => fn()));
    },
  };
}

beforeEach(() => {
  Object.defineProperty(window, 'innerHeight', { value: 844, configurable: true });
  Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true });
  useMapStore.getState().clearMap();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('BottomSheet', () => {
  it('exposes a handle button with aria-expanded and a region for the content', () => {
    render(<Harness initial="peek" />);
    const handle = screen.getByRole('button', { name: /painel/i });
    expect(handle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('region', { name: /painel/i })).toBeInTheDocument();
    expect(handle.getBoundingClientRect).toBeDefined();
    expect(handle.className).toMatch(/min-h-11/);
  });

  it('goes up with ArrowUp and down with ArrowDown on the handle', async () => {
    const user = userEvent.setup();
    render(<Harness initial="peek" />);
    const handle = screen.getByRole('button', { name: /painel/i });
    const region = screen.getByRole('region', { name: /painel/i });

    handle.focus();
    await user.keyboard('{ArrowUp}');
    expect(region).toHaveAttribute('data-snap', 'half');
    expect(handle).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{ArrowUp}');
    expect(region).toHaveAttribute('data-snap', 'full');
    await user.keyboard('{ArrowDown}');
    expect(region).toHaveAttribute('data-snap', 'half');
  });

  it('Escape goes full → half and half → peek, from inside the content', async () => {
    const user = userEvent.setup();
    render(<Harness initial="full" />);
    const region = screen.getByRole('region', { name: /painel/i });

    await user.click(screen.getByLabelText('Origem'));
    await user.keyboard('{Escape}');
    expect(region).toHaveAttribute('data-snap', 'half');
    await user.keyboard('{Escape}');
    expect(region).toHaveAttribute('data-snap', 'peek');
    await user.keyboard('{Escape}');
    expect(region).toHaveAttribute('data-snap', 'peek');
  });

  it('toggles half/peek by clicking the handle', async () => {
    const user = userEvent.setup();
    render(<Harness initial="half" />);
    const handle = screen.getByRole('button', { name: /painel/i });
    const region = screen.getByRole('region', { name: /painel/i });

    await user.click(handle);
    expect(region).toHaveAttribute('data-snap', 'peek');
    await user.click(handle);
    expect(region).toHaveAttribute('data-snap', 'half');
  });

  it('never grows beyond the visual viewport when the virtual keyboard opens', () => {
    const vv = fakeVisualViewport(844);
    render(<Harness initial="full" />);
    const region = screen.getByRole('region', { name: /painel/i });
    const before = parseInt(region.style.height, 10);

    vv.resize(400);

    const after = parseInt(region.style.height, 10);
    expect(after).toBeLessThanOrEqual(400);
    expect(after).toBeLessThan(before);
    expect(region.style.bottom).toBe('0px');
  });

  it('publishes padding.bottom per snap and restores it on unmount', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Harness initial="peek" />);
    const peek = useMapStore.getState().padding.bottom;
    expect(peek).toBe(sheetHeightFor('peek', 844) + 56);

    await user.click(screen.getByRole('button', { name: /painel/i }));
    expect(useMapStore.getState().padding.bottom).toBe(sheetHeightFor('half', 844) + 56);

    unmount();
    expect(useMapStore.getState().padding.bottom).toBe(0);
  });

  it('turns the transition off for prefers-reduced-motion', () => {
    render(<Harness />);
    expect(screen.getByRole('region', { name: /painel/i }).className).toMatch(/motion-reduce:transition-none/);
  });
});
