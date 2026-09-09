/**
 * The whole surface a module exposes to the shell.
 *
 * A module is one object. The shell derives its navigation and its routes from
 * these fields and knows nothing else about the module — which is the property
 * that makes "add a module = one file + one array entry" true.
 */

import type { ComponentType } from 'react';

import type { MapLayerDescriptor } from '../map/layers';

export interface ModuleDefinition {
  /** Stable, unique. Used as the registry key and the React key. */
  readonly id: string;
  /** What the nav shows. pt-BR. */
  readonly label: string;
  /** Optional nav icon. Any component taking a `className` — lucide-react fits. */
  readonly icon?: ComponentType<{ className?: string }>;
  /**
   * The module's root path, e.g. `/rota-custos`.
   *
   * The shell mounts the module at `${path}/*`, so a module owns every route
   * beneath its root and can nest its own `<Routes>` without asking the shell
   * for anything.
   */
  readonly path: string;
  /** The module's root component. */
  readonly Panel: ComponentType;
  /**
   * Layers this module contributes to the map, declared statically so the layer
   * manager can list and toggle them before any data has been fetched.
   */
  readonly mapLayers?: readonly MapLayerDescriptor[];
}
