import { NavLink } from 'react-router-dom';

import { SettingsDialog } from '@/core/layout/SettingsDialog';
import { cn } from '@/lib/utils';

import { AuthSlot } from '../../shared/AuthSlot';
import { DemoBadge } from '../../shared/DemoBadge';
import type { ModuleNavItem } from '../../shared/moduleNav';
import { ThemeToggle } from '../../shared/ThemeToggle';
import { MobileMenu } from './MobileMenu';

const ghostOnPrimary =
  'text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground';

/** Barra superior do layout B: marca, módulos (desktop) ou "Menu" (mobile), Ajustes e tema. */
export function TopBar({ items, mobile }: { items: readonly ModuleNavItem[]; mobile: boolean }) {
  return (
    <header className="app-sidebar sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-primary px-3 md:px-5">
      <span className="text-base font-bold leading-none tracking-tight text-primary-foreground md:text-lg">
        qual<span className="text-accent">roteiro</span>
      </span>
      <DemoBadge />

      {mobile ? (
        <div className="ml-auto flex items-center gap-1">
          <SettingsDialog triggerClassName={ghostOnPrimary} />
          <ThemeToggle className={ghostOnPrimary} />
          <MobileMenu items={items} />
        </div>
      ) : (
        <>
          <nav aria-label="Módulos" className="ml-4 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            {items.map(({ id, label, path, Icon }) => (
              <NavLink
                key={id}
                to={path}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors',
                    'text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isActive && 'bg-primary-foreground/15 text-primary-foreground',
                  )
                }
              >
                <Icon className="size-4 shrink-0" />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-1">
            <SettingsDialog triggerClassName={ghostOnPrimary} />
            <ThemeToggle className={ghostOnPrimary} />
            <AuthSlot />
          </div>
        </>
      )}
    </header>
  );
}
