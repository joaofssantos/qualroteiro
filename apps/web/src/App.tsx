import { BrowserRouter } from 'react-router-dom';

import { AppRouter } from '@/core/shell/AppRouter';
import { registerAppModules } from '@/modules';

/**
 * The composition root.
 *
 * Registers the modules, then hands off to the registry-driven router. This is
 * the only place where "which modules exist" and "how the app is routed" meet,
 * and it is three lines long — which is the point.
 *
 * Registration runs at import time rather than in an effect so the very first
 * render already has the nav and the routes.
 */
registerAppModules();

export function App() {
  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  );
}
