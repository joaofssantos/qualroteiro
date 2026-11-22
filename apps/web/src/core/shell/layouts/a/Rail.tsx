import { NavLink } from 'react-router-dom';

import { SettingsDialog } from '@/core/layout/SettingsDialog';
import { cn } from '@/lib/utils';

import { AuthSlot } from '../../shared/AuthSlot';
import { DemoBadge } from '../../shared/DemoBadge';
import { ThemeToggle } from '../../shared/ThemeToggle';
import type { ModuleNavItem } from '../../shared/moduleNav';

const moduleWayfindingClass: Record<string, string> = {
  'planejamento-viagem': 'text-module-planejamento',
  hospedagem: 'text-module-hospedagem',
  restaurantes: 'text-module-restaurantes',
  atividades: 'text-module-atividades',
};

const ghostOnRail =
  'text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground';

/**
 * Trilho de navegação (76 px no desktop): um link por módulo, com ícone e rótulo
 * curto, e o rodapé de Ajustes/tema/conta. No mobile (F7 troca por TabBar) vira
 * uma barra horizontal no topo.
 */
export function Rail({ items }: { items: readonly ModuleNavItem[] }) {
  return (
    <nav
      aria-label="Módulos"
      className={cn(
        'app-sidebar relative z-20 flex shrink-0 items-center gap-2 border-border bg-primary px-3 py-2',
        'border-b md:absolute md:inset-y-0 md:left-0 md:w-[76px] md:flex-col md:gap-1 md:border-b-0 md:border-r md:px-1.5 md:py-4',
      )}
    >
      <span className="text-sm font-bold leading-none tracking-tight text-primary-foreground md:mb-3 md:text-center md:text-[11px]">
        qual<span className="text-accent">roteiro</span>
      </span>

      <DemoBadge className="hidden md:block" />

      <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto md:w-full md:flex-col md:overflow-visible">
        {items.map(({ id, label, path, Icon }) => (
          <NavLink
            key={id}
            to={path}
            className={({ isActive }) =>
              cn(
                'group flex min-h-11 min-w-11 items-center gap-2 whitespace-nowrap rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                'md:flex-col md:justify-center md:gap-1 md:px-0.5 md:text-[10px] md:leading-tight',
                'text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground',
                isActive && 'bg-primary-foreground/15 text-primary-foreground',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={cn(
                    'size-5 shrink-0 transition-opacity group-hover:opacity-80',
                    !isActive && moduleWayfindingClass[id],
                  )}
                />
                <span className="md:max-w-full md:truncate">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-0 md:mt-auto md:flex-col">
        <SettingsDialog triggerClassName={ghostOnRail} />
        <ThemeToggle className={ghostOnRail} />
        <AuthSlot />
      </div>
    </nav>
  );
}
