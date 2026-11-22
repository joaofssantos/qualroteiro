import { type ReactNode, Suspense } from 'react';
import { useLocation } from 'react-router-dom';

import { listModules } from '@/core/registry/registry';

import { moduleNavItems } from '../../shared/moduleNav';
import { TopBar } from './TopBar';
import { useIsMobile } from '../../shared/useIsMobile';

/**
 * Layout B — custos primeiro, com mapa vivo. Barra superior + conteúdo em
 * página. O mapa não é montado aqui: `ConsultaHero`/`MapCard` o posicionam com
 * `MapSlot` (o mesmo nó do `AppShell`).
 */
export function ShellB({ children }: { children: ReactNode }) {
  const location = useLocation();
  const mobile = useIsMobile();
  const items = moduleNavItems(listModules(), location.pathname);

  return (
      <div data-testid="shell-b" className="flex min-h-screen flex-col bg-background">
        <TopBar items={items} mobile={mobile} />
        <main className="min-w-0 flex-1">
          <Suspense fallback={<div aria-busy="true" className="min-h-[60vh]" />}>{children}</Suspense>
        </main>
      </div>
  );
}
