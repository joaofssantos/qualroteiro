import { type ReactNode, Suspense, useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';

import { MapHostProvider } from '../layout/MapHost';
import { useLayoutDefinition } from '../layout/layouts';
import { MapCanvas } from '../map/MapCanvas';
import { useMapStore } from '../map/mapStore';
import { listModules } from '../registry/registry';

/**
 * Seletor fino de layout. Renderiza o shell do layout ativo (lazy) e mantém o
 * **único** `MapCanvas` aqui, fora do componente que troca: o mapa vive num
 * contêiner estável (`MapHost`) que cada shell posiciona com um `MapSlot`.
 * Trocar A↔B move o mesmo nó DOM — o `Map` não é recriado e o rascunho/resultado
 * (stores) não se perde.
 *
 * Este arquivo continua sem citar nenhum módulo concreto.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { Shell } = useLayoutDefinition();
  const location = useLocation();
  const activeModule = listModules().find(
    (module) =>
      location.pathname === module.path || location.pathname.startsWith(`${module.path}/`),
  );
  const showMap = activeModule?.showMap === true;

  const mapLayers = useMapStore((s) => s.layers);
  const mapTrace = useMapStore((s) => s.trace);
  const onMarkerClick = useMapStore((s) => s.onMarkerClick);

  const [element] = useState(() => {
    const el = document.createElement('div');
    el.className = 'h-full w-full';
    return el;
  });
  const [moved, setMoved] = useState(0);
  const notifyMoved = useCallback(() => setMoved((n) => n + 1), []);
  const host = useMemo(() => ({ element, notifyMoved }), [element, notifyMoved]);

  return (
    <MapHostProvider value={host}>
      <Suspense fallback={<div className="min-h-screen bg-background" aria-busy="true" />}>
        <Shell>{children}</Shell>
      </Suspense>
      {showMap
        ? createPortal(
            <MapCanvas
              trace={mapTrace?.coordinates ?? null}
              layers={mapLayers}
              onMarkerClick={onMarkerClick}
              resizeKey={moved}
            />,
            element,
          )
        : null}
    </MapHostProvider>
  );
}
