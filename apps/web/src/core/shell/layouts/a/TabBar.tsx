import { NavLink } from 'react-router-dom';

import { cn } from '@/lib/utils';

import type { ModuleNavItem } from '../../shared/moduleNav';

export const TAB_BAR_HEIGHT = 56;

/** Navegação mobile: um link por módulo, fixo na base, alvos ≥ 56 px. */
export function TabBar({ items }: { items: readonly ModuleNavItem[] }) {
  return (
    <nav
      aria-label="Módulos"
      className="app-sidebar fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-primary pb-[env(safe-area-inset-bottom)]"
    >
      {items.map(({ id, label, path, Icon }) => (
        <NavLink
          key={id}
          to={path}
          className={({ isActive }) =>
            cn(
              'flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 text-[10px] font-medium leading-tight transition-colors',
              'text-primary-foreground/70 hover:text-primary-foreground',
              isActive && 'bg-primary-foreground/15 text-primary-foreground',
            )
          }
        >
          <Icon aria-hidden className="size-5 shrink-0" />
          <span className="max-w-full truncate">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
