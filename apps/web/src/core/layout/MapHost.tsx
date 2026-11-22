import { type ReactNode, createContext, useContext, useLayoutEffect, useRef } from 'react';

import { cn } from '@/lib/utils';

export interface MapHostValue {
  /** Contêiner estável onde o único `MapCanvas` está montado (por portal). */
  element: HTMLElement;
  /** Avisa que o contêiner foi reposicionado, para o mapa chamar `resize()`. */
  notifyMoved(): void;
}

const MapHostContext = createContext<MapHostValue | null>(null);
export const MapHostProvider = MapHostContext.Provider;

/**
 * Posição do mapa dentro de um shell. Move o mesmo nó DOM (nunca recria o mapa)
 * para dentro do slot ativo.
 */
export function MapSlot({
  className,
  ...rest
}: { className?: string; children?: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  const host = useContext(MapHostContext);
  const slotRef = useRef<HTMLDivElement>(null);
  const notify = host?.notifyMoved;
  const element = host?.element;

  useLayoutEffect(() => {
    const slot = slotRef.current;
    if (!slot || !element) return;
    slot.appendChild(element);
    notify?.();
    return () => {
      if (element.parentNode === slot) slot.removeChild(element);
    };
  }, [element, notify]);

  return <div ref={slotRef} className={cn('relative', className)} {...rest} />;
}
