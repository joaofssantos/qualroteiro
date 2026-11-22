import { type ReactNode, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { SettingsDialog } from '@/core/layout/SettingsDialog';
import { MapSlot } from '@/core/layout/MapHost';
import { useMapStore } from '@/core/map/mapStore';
import { listModules } from '@/core/registry/registry';
import { cn } from '@/lib/utils';

import { AuthSlot } from '../../shared/AuthSlot';
import { DemoBadge } from '../../shared/DemoBadge';
import { ThemeToggle } from '../../shared/ThemeToggle';
import { moduleNavItems } from '../../shared/moduleNav';
import { BottomSheet } from './BottomSheet';
import { FloatingPanel } from './FloatingPanel';
import { Rail } from './Rail';
import { TAB_BAR_HEIGHT, TabBar } from './TabBar';
import { useSheetSnap } from './useSheetSnap';

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

const MOBILE_QUERY = '(max-width: 767px)';

function isDesktop(): boolean {
  return typeof window.matchMedia !== 'function' || !window.matchMedia(MOBILE_QUERY).matches;
}

/** `true` abaixo de 768 px; acompanha mudanças de tamanho/orientação. */
function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() => !isDesktop());
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(MOBILE_QUERY);
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return mobile;
}

const ghostOnBar = 'text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground';

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
  const mobile = useIsMobile();
  const sheet = useSheetSnap('half');

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
    if (!showMap || mobile) return;
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
  }, [showMap, collapsed, mobile]);

  if (mobile) {
    return (
      <div className="relative h-screen overflow-hidden bg-background">
        <div className="fixed right-2 top-2 z-30 flex items-center gap-1 rounded-full bg-primary px-1 py-0.5 shadow-md">
          <DemoBadge />
          <SettingsDialog triggerClassName={cn('min-h-11 min-w-11', ghostOnBar)} />
          <ThemeToggle className={cn('min-h-11 min-w-11', ghostOnBar)} />
          <AuthSlot compact />
        </div>
        {showMap ? (
          <>
            <MapSlot data-testid="app-map-container" className="absolute inset-0" />
            <BottomSheet snap={sheet.snap} onSnapChange={sheet.setSnap} bottomOffset={TAB_BAR_HEIGHT}>
              {children}
            </BottomSheet>
          </>
        ) : (
          <main className="h-full overflow-y-auto pt-14" style={{ paddingBottom: TAB_BAR_HEIGHT }}>
            {children}
          </main>
        )}
        <TabBar items={items} />
      </div>
    );
  }

  return (
    <div className="relative h-screen overflow-hidden bg-background">
      <Rail items={items} />
      {showMap ? (
        <>
          <MapSlot
            data-testid="app-map-container"
            className="absolute inset-0"
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
        <main className="absolute inset-y-0 right-0 overflow-y-auto" style={{ left: RAIL_WIDTH }}>
          {children}
        </main>
      )}
    </div>
  );
}
