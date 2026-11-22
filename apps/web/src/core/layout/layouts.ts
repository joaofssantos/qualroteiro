import { type ComponentType, type LazyExoticComponent, type ReactNode, lazy } from 'react';

import { LAYOUT_META, type LayoutId } from './layoutConfig';
import { useLayoutStore } from './layoutStore';
import { shellLoaders } from './shellLoaders';

export interface LayoutDefinition {
  id: LayoutId;
  label: string;
  description: string;
  Shell: LazyExoticComponent<ComponentType<{ children: ReactNode }>>;
  livePreview: boolean;
}

export const LAYOUTS: Record<LayoutId, LayoutDefinition> = {
  a: { id: 'a', ...LAYOUT_META.a, Shell: lazy(() => shellLoaders.a()) },
  b: { id: 'b', ...LAYOUT_META.b, Shell: lazy(() => shellLoaders.b()) },
};

export function useLayoutDefinition(): LayoutDefinition {
  return LAYOUTS[useLayoutStore((s) => s.layout)];
}
