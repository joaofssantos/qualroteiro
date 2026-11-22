import { describe, expect, it } from 'vitest';

import type { ModuleDefinition } from '@/core/registry/types';

import { moduleNavItems } from './moduleNav';

const mod = (id: string, path: string): ModuleDefinition => ({
  id,
  label: id.toUpperCase(),
  path,
  Panel: () => null,
});

describe('moduleNavItems', () => {
  it('derives items and marks the active module by path prefix', () => {
    const items = moduleNavItems([mod('x', '/x'), mod('xy', '/xy')], '/x/resultado');

    expect(items.map((i) => [i.id, i.label, i.isActive])).toEqual([
      ['x', 'X', true],
      ['xy', 'XY', false],
    ]);
  });

  it('falls back to a default icon', () => {
    expect(moduleNavItems([mod('x', '/x')], '/')[0]?.Icon).toBeTypeOf('object');
  });
});
