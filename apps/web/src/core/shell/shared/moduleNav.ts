import { Map as MapIcon } from 'lucide-react';
import type { ComponentType } from 'react';

import type { ModuleDefinition } from '@/core/registry/types';

export interface ModuleNavItem {
  id: string;
  label: string;
  path: string;
  Icon: ComponentType<{ className?: string }>;
  isActive: boolean;
}

/** Itens de navegação derivados do registro de módulos (sem citar nenhum módulo). */
export function moduleNavItems(
  modules: readonly ModuleDefinition[],
  pathname: string,
): ModuleNavItem[] {
  return modules.map((module) => ({
    id: module.id,
    label: module.label,
    path: module.path,
    Icon: module.icon ?? MapIcon,
    isActive: pathname === module.path || pathname.startsWith(`${module.path}/`),
  }));
}
