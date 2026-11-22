import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LAYOUT_STORAGE_KEY } from './layoutConfig';
import { useLayoutStore } from './layoutStore';

beforeEach(() => {
  window.localStorage.clear();
  useLayoutStore.setState({ layout: 'a' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useLayoutStore', () => {
  it('persists the choice in localStorage', () => {
    useLayoutStore.getState().setLayout('b');

    expect(useLayoutStore.getState().layout).toBe('b');
    expect(window.localStorage.getItem(LAYOUT_STORAGE_KEY)).toBe('b');
  });

  it('follows a storage event from another tab', () => {
    useLayoutStore.setState({ layout: 'b' });

    window.dispatchEvent(new StorageEvent('storage', { key: LAYOUT_STORAGE_KEY, newValue: 'a' }));

    expect(useLayoutStore.getState().layout).toBe('a');
  });

  it('ignores a storage event with an invalid value or another key', () => {
    useLayoutStore.setState({ layout: 'b' });

    window.dispatchEvent(new StorageEvent('storage', { key: LAYOUT_STORAGE_KEY, newValue: 'x' }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'other', newValue: 'a' }));

    expect(useLayoutStore.getState().layout).toBe('b');
  });

  it('does not throw when setItem throws, and still switches the layout', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });

    expect(() => useLayoutStore.getState().setLayout('b')).not.toThrow();
    expect(useLayoutStore.getState().layout).toBe('b');
  });
});
