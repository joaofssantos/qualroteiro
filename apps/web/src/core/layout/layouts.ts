import { type ComponentType, type LazyExoticComponent, type ReactNode, lazy } from 'react';

import { LAYOUT_META, type LayoutId, registeredLayoutIds, resolveLayoutId } from './layoutConfig';
import { useLayoutStore } from './layoutStore';
import { shellLoaders } from './shellLoaders';

export interface LayoutDefinition {
  id: LayoutId;
  label: string;
  description: string;
  Shell: LazyExoticComponent<ComponentType<{ children: ReactNode }>>;
  livePreview: boolean;
}

/**
 * Registro derivado de `LAYOUT_META`: uma entrada por layout registrado.
 * Remover uma direção: docs/decisions/0003-layout-a-b.md.
 */
export const LAYOUTS = Object.fromEntries(
  registeredLayoutIds().map((id) => [
    id,
    { id, ...LAYOUT_META[id], Shell: lazy(() => shellLoaders[id]()) } satisfies LayoutDefinition,
  ]),
) as Record<LayoutId, LayoutDefinition>;

export function useLayoutDefinition(): LayoutDefinition {
  return LAYOUTS[resolveLayoutId(useLayoutStore((s) => s.layout))];
}
