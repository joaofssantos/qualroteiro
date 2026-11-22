import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { MapSlot } from '@/core/layout/MapHost';
import { SettingsDialog } from '@/core/layout/SettingsDialog';
import { listModules } from '@/core/registry/registry';
import { cn } from '@/lib/utils';

import { AuthSlot } from '../../shared/AuthSlot';
import { DemoBadge } from '../../shared/DemoBadge';
import { ThemeToggle } from '../../shared/ThemeToggle';
import { moduleNavItems } from '../../shared/moduleNav';

export const SIDEBAR_STORAGE_KEY = 'qualroteiro:sidebar-collapsed';

const moduleWayfindingClass: Record<string, string> = {
  'planejamento-viagem': 'text-module-planejamento',
  hospedagem: 'text-module-hospedagem',
  restaurantes: 'text-module-restaurantes',
  atividades: 'text-module-atividades',
};

/**
 * O shell atual (sidebar + mapa 4/5 + painel 1/5), extraído de `AppShell` sem
 * mudar o markup. Layouts `a` e `b` reexportam este shell até F6/F10.
 *
 * O mapa não é montado aqui: `AppShell` mantém o único `MapCanvas` fora do
 * shell lazy e este componente só oferece o `MapSlot` onde ele aparece.
 */
export function LegacyShell({ children }: { children: ReactNode }) {
  const modules = listModules();
  const location = useLocation();
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(
    () => window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true',
  );

  const items = moduleNavItems(modules, location.pathname);
  const activeId = items.find((i) => i.isActive)?.id;
  const showMap = modules.find((m) => m.id === activeId)?.showMap === true;

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      <nav
        aria-label="Módulos"
        className={cn(
          'app-sidebar relative z-10 flex shrink-0 items-center gap-3 border-border bg-primary px-3 py-2.5',
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

        <DemoBadge className="md:mb-4" />

        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto md:flex-col md:overflow-visible">
          {items.map(({ id, label, path, Icon }) => (
            <NavLink
              key={id}
              to={path}
              aria-label={isSidebarCollapsed ? label : undefined}
              title={isSidebarCollapsed ? label : undefined}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-2.5 whitespace-nowrap rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                  'text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground',
                  isActive && 'bg-primary-foreground/15 text-primary-foreground',
                  isSidebarCollapsed && 'md:justify-center md:px-2',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cn(
                      'size-4 shrink-0 transition-opacity group-hover:opacity-80',
                      !isActive && moduleWayfindingClass[id],
                    )}
                  />
                  <span className={cn(isSidebarCollapsed && 'md:sr-only')}>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>

        <div className={cn('ml-auto flex shrink-0 items-center gap-1 md:ml-0 md:mt-auto md:flex-col', isSidebarCollapsed && 'md:mx-auto')}>
          <SettingsDialog triggerClassName="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground" />
          <ThemeToggle className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground" />
          <div className={cn(isSidebarCollapsed && 'md:hidden')}>
            <AuthSlot />
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
          <MapSlot
            data-testid="app-map-container"
            className="h-[30vh] min-h-48 max-h-[22rem] shrink-0 md:h-auto md:min-h-0 md:max-h-none md:w-4/5"
          />
        ) : null}
        <div className={cn(showMap && 'map-content-panel min-h-0 flex-1 overflow-x-hidden overflow-y-auto md:w-1/5')}>
          {children}
        </div>
      </main>
    </div>
  );
}
