import { Route as RouteIcon } from 'lucide-react';
import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';

import type { ModuleDefinition } from '@/core/registry/types';
import { useRouteStore } from '@/core/store/routeStore';

import { NewQueryScreen } from './NewQueryScreen';
import { ResultScreen } from './ResultScreen';
import { RotaCustosLayout } from './RotaCustosLayout';
import { MODULE_PATH, ROTA_CUSTOS_LAYERS } from './module';

/**
 * "Rota & Custos" — qualroteiro's first module.
 *
 * Everything the shell knows about this module is the object exported at the
 * bottom of this file. The module owns its own routes beneath `MODULE_PATH`,
 * declares the map layers it contributes, and registers them with the core's
 * layer manager on mount.
 */
function RotaCustosPanel() {
  const registerLayer = useRouteStore((s) => s.registerLayer);

  // Declared statically on the module, registered when the module mounts — so a
  // layer exists to be toggled even before a route has been planned.
  useEffect(() => {
    for (const layer of ROTA_CUSTOS_LAYERS) registerLayer(layer);
  }, [registerLayer]);

  return (
    <Routes>
      <Route element={<RotaCustosLayout />}>
        <Route index element={<NewQueryScreen />} />
        <Route path="resultado" element={<ResultScreen />} />
      </Route>
    </Routes>
  );
}

export const rotaCustosModule: ModuleDefinition = {
  id: 'rota-custos',
  label: 'Rota & Custos',
  icon: RouteIcon,
  path: MODULE_PATH,
  Panel: RotaCustosPanel,
  mapLayers: ROTA_CUSTOS_LAYERS,
};
