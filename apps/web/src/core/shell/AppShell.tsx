import { Map as MapIcon, Moon, PanelLeftClose, PanelLeftOpen, Sun } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

import { AuthActions } from '@/core/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { isDemoMode } from '../api/demo/mode';
import { MapCanvas } from '../map/MapCanvas';
import { useMapStore } from '../map/mapStore';
import { listModules } from '../registry/registry';
import { useTheme } from './useTheme';

export const SIDEBAR_STORAGE_KEY = 'qualroteiro:sidebar-collapsed';

/**
 * The application chrome: a navigation whose entries are **generated from the
 * module registry**, and a content well.
 *
 * This file contains no reference to any concrete module. Adding "Frete" adds a
 * nav entry here without this file changing — that is the whole design.
 *
 * The nav is one element that reflows rather than a desktop copy plus a mobile
 * copy: two copies would put two links with the same accessible name in the
 * document, which is a real problem for assistive technology (and, usefully, is
 * caught immediately by a `getByRole('link', { name })` query in the tests).
 *
 * `MapCanvas` is mounted here, once, reading from `core/map/mapStore` — the
 * *shell* owns the map's lifetime, not any one module, which is what lets it
 * survive navigation between modules instead of tearing down its WebGL context
 * every time. It only renders while the active module (matched by URL against
 * `module.path`) declares `showMap: true`; every other module keeps exactly
 * today's full-width layout. A module publishes to the store, not to this
 * component directly — this file still knows nothing about what a toll plaza or
 * a hotel is.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const modules = listModules();
  const location = useLocation();
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(
    () => window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true',
  );
  const { theme, toggleTheme } = useTheme();

  const activeModule = modules.find(
    (module) =>
      location.pathname === module.path || location.pathname.startsWith(`${module.path}/`),
  );
  const showMap = activeModule?.showMap === true;

  const mapLayers = useMapStore((s) => s.layers);
  const mapTrace = useMapStore((s) => s.trace);
  const onMarkerClick = useMapStore((s) => s.onMarkerClick);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      <nav
        aria-label="Módulos"
        className={cn(
          'relative z-10 flex shrink-0 items-center gap-3 border-border bg-primary px-3 py-2.5',
          'border-b md:flex-col md:items-stretch md:gap-1 md:border-b-0 md:border-r md:py-5',
          isSidebarCollapsed ? 'md:w-16' : 'md:w-56',
        )}
      >
        <div className="flex items-center justify-between md:mb-6 md:px-2">
          <div className={cn(isSidebarCollapsed && 'md:sr-only')}>
            <span className="block text-base font-bold leading-none tracking-tight text-primary-foreground md:text-lg">
              qual<span className="text-accent">roteiro</span>
            </span>
            <span className="mt-1 hidden text-[11px] uppercase tracking-widest text-primary-foreground/50 md:block">
              planejamento de viagem
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="hidden text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground md:inline-flex"
            aria-label={isSidebarCollapsed ? 'Expandir menu lateral' : 'Minimizar menu lateral'}
            title={isSidebarCollapsed ? 'Expandir menu lateral' : 'Minimizar menu lateral'}
            onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
          >
            {isSidebarCollapsed ? <PanelLeftOpen aria-hidden /> : <PanelLeftClose aria-hidden />}
          </Button>
        </div>

        {isDemoMode() ? (
          <div
            role="status"
            className={cn(
              'shrink-0 rounded-md bg-amber-400 px-2 py-1 text-center text-[11px] font-bold uppercase tracking-wide text-amber-950',
              'md:mb-4',
            )}
          >
            modo demonstração
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto md:flex-col md:overflow-visible">
          {modules.map((module) => {
            const Icon = module.icon ?? MapIcon;
            return (
              <NavLink
                key={module.id}
                to={module.path}
                aria-label={isSidebarCollapsed ? module.label : undefined}
                title={isSidebarCollapsed ? module.label : undefined}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 whitespace-nowrap rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                    'text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground',
                    isActive && 'bg-primary-foreground/15 text-primary-foreground',
                    isSidebarCollapsed && 'md:justify-center md:px-2',
                  )
                }
              >
                <Icon className="size-4 shrink-0" />
                <span className={cn(isSidebarCollapsed && 'md:sr-only')}>{module.label}</span>
              </NavLink>
            );
          })}
        </div>

        <div className={cn('ml-auto flex shrink-0 items-center gap-1 md:ml-0 md:mt-auto md:flex-col', isSidebarCollapsed && 'md:mx-auto')}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            aria-label={theme === 'dark' ? 'Alternar para tema claro' : 'Alternar para tema escuro'}
            title={theme === 'dark' ? 'Alternar para tema claro' : 'Alternar para tema escuro'}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? <Sun aria-hidden /> : <Moon aria-hidden />}
          </Button>
          <div className={cn(isSidebarCollapsed && 'md:hidden')}>
            <AuthActions />
          </div>
        </div>
      </nav>

      <main
        className={cn(
          'min-w-0 flex-1',
          showMap && 'flex h-[calc(100vh-3.25rem)] flex-col overflow-hidden md:h-screen md:flex-row',
        )}
      >
        {showMap ? (
          <div
            data-testid="app-map-container"
            className="relative h-[30vh] min-h-48 max-h-[22rem] shrink-0 md:h-auto md:min-h-0 md:max-h-none md:w-4/5"
          >
            <MapCanvas
              trace={mapTrace?.coordinates ?? null}
              layers={mapLayers}
              onMarkerClick={onMarkerClick}
            />
          </div>
        ) : null}
        <div className={cn(showMap && 'map-content-panel min-h-0 flex-1 overflow-x-hidden overflow-y-auto md:w-1/5')}>
          {children}
        </div>
      </main>
    </div>
  );
}
