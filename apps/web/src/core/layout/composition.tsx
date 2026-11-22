import { type ComponentType, type ReactNode, createContext, useContext } from 'react';

import type { TollPlaza } from '@/core/api/types';

/**
 * Slot de composição (spec §4.4): um shell pode oferecer a um módulo telas
 * diferentes das padrão, sem o módulo conhecer o layout e sem ramificar por
 * `layout === 'b'` dentro dos blocos. Vazio = o módulo usa as próprias telas.
 */
export interface LayoutComposition {
  /** Tela de nova consulta. */
  Consulta?: ComponentType;
  /** Tela de resultado; recebe o que o módulo costuma passar por contexto de rota. */
  Resultado?: ComponentType<{ onSelectPlaza(plaza: TollPlaza | null): void }>;
}

const EMPTY: LayoutComposition = {};
const CompositionContext = createContext<LayoutComposition>(EMPTY);

export function LayoutCompositionProvider({
  value,
  children,
}: {
  value: LayoutComposition;
  children: ReactNode;
}) {
  return <CompositionContext.Provider value={value}>{children}</CompositionContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook de contexto, ao lado do provider
export function useLayoutComposition(): LayoutComposition {
  return useContext(CompositionContext);
}
