import { Map as MapIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

import { cn } from '@/lib/utils';

import { isDemoMode } from '../api/demo/mode';
import { listModules } from '../registry/registry';

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
 */
export function AppShell({ children }: { children: ReactNode }) {
  const modules = listModules();

  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      <nav
        aria-label="Módulos"
        className={cn(
          'flex shrink-0 items-center gap-3 border-border bg-primary px-3 py-2.5',
          'border-b md:w-56 md:flex-col md:items-stretch md:gap-1 md:border-b-0 md:border-r md:py-5',
        )}
      >
        <div className="md:mb-6 md:px-2">
          <span className="block text-base font-bold leading-none tracking-tight text-primary-foreground md:text-lg">
            qual<span className="text-accent">roteiro</span>
          </span>
          <span className="mt-1 hidden text-[11px] uppercase tracking-widest text-primary-foreground/50 md:block">
            planejamento de viagem
          </span>
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
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 whitespace-nowrap rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                    'text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground',
                    isActive && 'bg-primary-foreground/15 text-primary-foreground',
                  )
                }
              >
                <Icon className="size-4 shrink-0" />
                {module.label}
              </NavLink>
            );
          })}
        </div>
      </nav>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
