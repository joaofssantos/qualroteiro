/**
 * The module registry.
 *
 * A `Map` keyed by module id, insertion-ordered — so `listModules()` returns
 * modules in the order they were registered, and the nav's order is the order of
 * the array in `src/modules/index.ts` rather than something incidental.
 *
 * Registration is mutable and idempotent on purpose. A frozen static array would
 * read as tidier, but then the only way to prove extensibility would be to edit a
 * core file inside the test — which is exactly the thing the architecture forbids.
 * With `registerModule`, the extensibility test declares a module inside itself
 * and registers it, and the core stays untouched.
 */

import type { ModuleDefinition } from './types';

const modules = new Map<string, ModuleDefinition>();

/**
 * Add a module. Registering the same id twice replaces the definition rather
 * than duplicating the nav entry, which keeps React's StrictMode double-invoke
 * and a hot reload from producing two of everything.
 */
export function registerModule(definition: ModuleDefinition): void {
  modules.set(definition.id, definition);
}

/** Every registered module, in registration order. */
export function listModules(): readonly ModuleDefinition[] {
  return [...modules.values()];
}

/** One module by id, or `undefined`. */
export function getModule(id: string): ModuleDefinition | undefined {
  return modules.get(id);
}

/** Remove a module. Present for tests and for a future runtime feature flag. */
export function unregisterModule(id: string): void {
  modules.delete(id);
}

/** Empty the registry. Tests call this between cases; production never does. */
export function resetRegistry(): void {
  modules.clear();
}

/** Every map layer declared by every registered module. */
export function listRegisteredLayers(): readonly { moduleId: string; id: string; label: string; defaultVisible?: boolean }[] {
  return listModules().flatMap((module) =>
    (module.mapLayers ?? []).map((layer) => ({ moduleId: module.id, ...layer })),
  );
}
