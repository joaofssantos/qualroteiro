/**
 * THE ARRAY.
 *
 * This is the single place that names concrete modules. Adding a module to
 * qualroteiro is: write the module file, import it here, add it to `appModules`.
 * Nothing in `src/core/**` changes — see `src/core/registry/extensibility.test.tsx`,
 * which proves that by registering a module the core has never heard of.
 */

import { registerModule } from '@/core/registry/registry';
import type { ModuleDefinition } from '@/core/registry/types';

import { planejamentoViagemModule } from './planejamento-viagem';
import { rotaCustosModule } from './rota-custos';

/** Every module this build ships, in nav order. */
export const appModules: readonly ModuleDefinition[] = [
  rotaCustosModule,
  planejamentoViagemModule,
  // Next: hospedagem, restaurantes, atividades. One entry each.
];

/** Called once at startup by `App`. */
export function registerAppModules(): void {
  for (const module of appModules) registerModule(module);
}
