import { type ComponentType, type ReactNode, Suspense, lazy } from 'react';
import { useLocation } from 'react-router-dom';

import { LayoutCompositionProvider } from '@/core/layout/composition';
import { listModules } from '@/core/registry/registry';

import { moduleNavItems } from '../../shared/moduleNav';
import { TopBar } from './TopBar';
import { useIsMobile } from './useIsMobile';

import type { LayoutComposition } from '@/core/layout/composition';

// `lazy` por duas razões: o chunk do B só carrega o que usa e, principalmente,
// quebra o ciclo shellLoaders → layouts/b → QueryForm → layouts → shellLoaders.
const Consulta = lazy(() =>
  import('./ConsultaHero').then((m) => ({ default: m.ConsultaHero as ComponentType })),
);
const Resultado = lazy(() =>
  import('./ResultadoPage').then((m) => ({ default: m.ResultadoPage as NonNullable<LayoutComposition['Resultado']> })),
);
const COMPOSITION: LayoutComposition = { Consulta, Resultado };

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
    <LayoutCompositionProvider value={COMPOSITION}>
      <div data-testid="shell-b" className="flex min-h-screen flex-col bg-background">
        <TopBar items={items} mobile={mobile} />
        <main className="min-w-0 flex-1">
          <Suspense fallback={<div aria-busy="true" className="min-h-[60vh]" />}>{children}</Suspense>
        </main>
      </div>
    </LayoutCompositionProvider>
  );
}
