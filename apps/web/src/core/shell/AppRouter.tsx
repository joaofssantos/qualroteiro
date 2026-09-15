import { Navigate, Route, Routes } from 'react-router-dom';

import { EmptyState } from '@/components/ui/card';

import { listModules } from '../registry/registry';
import { AppShell } from './AppShell';

/**
 * Routes, derived from the registry.
 *
 * Each module is mounted at `${path}/*` so it owns everything beneath its root
 * and can nest its own `<Routes>` — "Rota & Custos" uses that for its three
 * screens. Nothing here names a module.
 *
 * Deliberately router-agnostic about *which* router wraps it: production supplies
 * `BrowserRouter`, tests supply `MemoryRouter`. That is what lets the
 * extensibility test drive real navigation without a browser.
 */
export function AppRouter() {
  const modules = listModules();
  const first = modules[0];

  return (
    <AppShell>
      <Routes>
        {modules.map((module) => (
          <Route key={module.id} path={`${module.path}/*`} element={<module.Panel />} />
        ))}

        <Route
          path="/"
          element={
            first ? (
              <Navigate to={first.path} replace />
            ) : (
              <EmptyState
                className="m-8"
                title="Nenhum módulo registrado"
                description="Adicione um módulo em src/modules/index.ts."
              />
            )
          }
        />

        <Route
          path="*"
          element={
            <EmptyState
              className="m-8"
              title="Página não encontrada"
              description="O endereço acessado não corresponde a nenhum módulo."
            />
          }
        />
      </Routes>
    </AppShell>
  );
}
