import { type ReactNode, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { MapSlot } from '@/core/layout/MapHost';
import { useMapStore } from '@/core/map/mapStore';
import { listModules } from '@/core/registry/registry';
import { cn } from '@/lib/utils';

import { moduleNavItems } from '../../shared/moduleNav';
import { FloatingPanel } from './FloatingPanel';
import { Rail } from './Rail';

export const PANEL_STORAGE_KEY = 'qualroteiro:panel-collapsed';
export const RAIL_WIDTH = 76;
export const PANEL_WIDTH = 416;
export const PANEL_GAP = 16;

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(PANEL_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Abaixo de `md` o shell empilha (F7 troca por BottomSheet); lá não há painel por cima do mapa. */
function isDesktop(): boolean {
  return typeof window.matchMedia !== 'function' || window.matchMedia('(min-width: 768px)').matches;
}

/**
 * Direção A (desktop): mapa em tela cheia atrás de um painel flutuante único e
 * de um trilho de 76 px. O mapa não é montado aqui — `AppShell` mantém o único
 * `MapCanvas` e este shell só oferece o `MapSlot`.
 */
export function ShellA({ children }: { children: ReactNode }) {
  const modules = listModules();
  const location = useLocation();
  const items = moduleNavItems(modules, location.pathname);
  const activeId = items.find((i) => i.isActive)?.id;
  const showMap = modules.find((m) => m.id === activeId)?.showMap === true;

  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toggle = () => {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(PANEL_STORAGE_KEY, String(next));
      } catch {
        // Sem armazenamento: a preferência só vale nesta sessão.
      }
      return next;
    });
  };

  // O painel cobre parte do mapa: o mapa enquadra pinos/traço só na área livre.
  useEffect(() => {
    if (!showMap || !isDesktop()) return;
    const left = collapsed ? RAIL_WIDTH : RAIL_WIDTH + PANEL_WIDTH + PANEL_GAP;
    const publish = () => {
      const current = useMapStore.getState().padding;
      if (current.left !== left || current.top || current.right || current.bottom) {
        useMapStore.getState().setMapPadding({ top: 0, right: 0, bottom: 0, left });
      }
    };
    publish();
    // `clearMap()` (cleanup de um módulo ao desmontar) zera o padding: reaplica.
    const unsubscribe = useMapStore.subscribe(publish);
    return () => {
      unsubscribe();
      useMapStore.getState().setMapPadding({ top: 0, right: 0, bottom: 0, left: 0 });
    };
  }, [showMap, collapsed]);

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-background md:block">
      <Rail items={items} />
      {showMap ? (
        <>
          <MapSlot
            data-testid="app-map-container"
            className="h-[30vh] min-h-48 shrink-0 md:absolute md:inset-0 md:h-auto md:min-h-0"
          />
          <FloatingPanel
            collapsed={collapsed}
            onToggle={toggle}
            panelWidth={PANEL_WIDTH}
            railWidth={RAIL_WIDTH}
            gap={PANEL_GAP}
          >
            {children}
          </FloatingPanel>
        </>
      ) : (
        <main className={cn('min-h-0 flex-1 overflow-y-auto md:absolute md:inset-y-0 md:right-0')} style={{ left: RAIL_WIDTH }}>
          {children}
        </main>
      )}
    </div>
  );
}
