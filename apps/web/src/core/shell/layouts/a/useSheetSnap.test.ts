import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { snapFromDrag, useSheetSnap } from './useSheetSnap';

describe('useSheetSnap', () => {
  it('cycles peek → half → full and stops at the limits', () => {
    const { result } = renderHook(() => useSheetSnap('peek'));

    act(() => result.current.prev());
    expect(result.current.snap).toBe('peek');
    act(() => result.current.next());
    expect(result.current.snap).toBe('half');
    act(() => result.current.next());
    expect(result.current.snap).toBe('full');
    act(() => result.current.next());
    expect(result.current.snap).toBe('full');
    act(() => result.current.prev());
    expect(result.current.snap).toBe('half');
  });

  it('sets a snap directly', () => {
    const { result } = renderHook(() => useSheetSnap('half'));
    act(() => result.current.setSnap('full'));
    expect(result.current.snap).toBe('full');
  });
});

describe('snapFromDrag', () => {
  it('keeps the snap on a tiny, slow drag', () => {
    expect(snapFromDrag('half', 500, 490, 0)).toBe('half');
  });

  it('moves one step up when dragging up past the threshold', () => {
    expect(snapFromDrag('half', 500, 380, 0)).toBe('full');
  });

  it('moves one step down when dragging down past the threshold', () => {
    expect(snapFromDrag('half', 300, 430, 0)).toBe('peek');
  });

  it('lets a fast flick win over a short distance (negative velocity = up)', () => {
    expect(snapFromDrag('peek', 600, 585, -1.2)).toBe('half');
    expect(snapFromDrag('full', 100, 115, 1.2)).toBe('half');
  });

  it('never leaves the peek/full limits', () => {
    expect(snapFromDrag('full', 500, 300, -2)).toBe('full');
    expect(snapFromDrag('peek', 300, 600, 2)).toBe('peek');
  });
});
