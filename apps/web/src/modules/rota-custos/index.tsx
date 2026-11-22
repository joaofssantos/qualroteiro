import { Route as RouteIcon } from 'lucide-react';
import { type ComponentType, lazy, useEffect } from 'react';
import { Route, Routes, useOutletContext } from 'react-router-dom';

import type { TollPlaza } from '@/core/api/types';
import type { LayoutId } from '@/core/layout/layoutConfig';
import { useLayoutStore } from '@/core/layout/layoutStore';

import type { ModuleDefinition } from '@/core/registry/types';
import { useRouteStore } from '@/core/store/routeStore';

import { NewQueryScreen } from './NewQueryScreen';
import { ResultScreen } from './ResultScreen';
import { type RotaCustosOutletContext, RotaCustosLayout } from './RotaCustosLayout';
import { MODULE_PATH, ROTA_CUSTOS_LAYERS } from './module';

/**
 * "Rota & Custos" — qualroteiro's first module.
 *
 * Everything the shell knows about this module is the object exported at the
 * bottom of this file. The module owns its own routes beneath `MODULE_PATH`,
 * declares the map layers it contributes, and registers them with the core's
 * layer manager on mount.
 */
/**
 * Composição por layout (spec §4.4): as telas são composições finas dos mesmos
 * blocos. O layout B oferece as suas; os demais usam as telas padrão. `lazy`
 * mantém as telas do B fora do chunk inicial.
 */
interface Composition {
  Consulta: ComponentType;
  Resultado: ComponentType<{ onSelectPlaza(plaza: TollPlaza | null): void }>;
}

const DEFAULT_COMPOSITION: Composition = {
  Consulta: NewQueryScreen,
  Resultado: () => <ResultScreen />,
};

const LayoutBConsulta = lazy(() =>
  import('./layoutB/ConsultaHero').then((m) => ({ default: m.ConsultaHero })),
);
const LayoutBResultado = lazy(() =>
  import('./layoutB/ResultadoPage').then((m) => ({ default: m.ResultadoPage })),
);

const COMPOSITIONS: Partial<Record<LayoutId, Composition>> = {
  b: { Consulta: LayoutBConsulta, Resultado: LayoutBResultado },
};

function useComposition(): Composition {
  const layout = useLayoutStore((s) => s.layout);
  return COMPOSITIONS[layout] ?? DEFAULT_COMPOSITION;
}

function ConsultaRoute() {
  const { Consulta } = useComposition();
  return <Consulta />;
}

function ResultadoRoute() {
  const { Resultado } = useComposition();
  const { onSelectPlaza } = useOutletContext<RotaCustosOutletContext>();
  return <Resultado onSelectPlaza={onSelectPlaza} />;
}

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
        <Route index element={<ConsultaRoute />} />
        <Route path="resultado" element={<ResultadoRoute />} />
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
  showMap: true,
};
