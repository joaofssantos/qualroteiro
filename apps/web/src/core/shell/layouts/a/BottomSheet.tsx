import { type KeyboardEvent, type PointerEvent, type ReactNode, useEffect, useRef, useState } from 'react';

import { useMapStore } from '@/core/map/mapStore';
import { cn } from '@/lib/utils';

import { type SheetSnap, SNAP_ORDER, sheetHeightFor, snapFromDrag } from './useSheetSnap';

/** Diferença (px) entre janela e `visualViewport` a partir da qual há teclado virtual. */
const KEYBOARD_THRESHOLD = 120;

function readViewport() {
  const vv = window.visualViewport;
  const height = vv?.height ?? window.innerHeight;
  return { height, keyboard: window.innerHeight - height > KEYBOARD_THRESHOLD };
}

interface BottomSheetProps {
  snap: SheetSnap;
  onSnapChange(snap: SheetSnap): void;
  /** Altura (px) da barra de abas sob o sheet. */
  bottomOffset?: number;
  label?: string;
  children: ReactNode;
}

/**
 * Bottom sheet próprio (sem dependência) com três alturas. Teclado: alça com
 * ↑/↓ e clique (alterna meia/baixa), `Esc` desce um degrau. Ponteiro: arrasto
 * da alça decidido por `snapFromDrag`. Com teclado virtual aberto, o sheet cola
 * na base e nunca passa da altura visível.
 */
export function BottomSheet({ snap, onSnapChange, bottomOffset = 0, label = 'Painel', children }: BottomSheetProps) {
  const [viewport, setViewport] = useState(readViewport);
  const drag = useRef<{ y: number; t: number } | null>(null);

  useEffect(() => {
    const update = () => setViewport(readViewport());
    const vv = window.visualViewport;
    vv?.addEventListener('resize', update);
    window.addEventListener('resize', update);
    return () => {
      vv?.removeEventListener('resize', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  const offset = viewport.keyboard ? 0 : bottomOffset;
  const available = viewport.height - offset;
  const height = Math.min(sheetHeightFor(snap, viewport.height), available);
  const mapBottom = sheetHeightFor(snap === 'full' ? 'half' : snap, viewport.height) + bottomOffset;

  // O sheet cobre a base do mapa: o mapa enquadra só a área livre.
  useEffect(() => {
    const publish = () => {
      const current = useMapStore.getState().padding;
      if (current.bottom !== mapBottom || current.left || current.top || current.right) {
        useMapStore.getState().setMapPadding({ top: 0, right: 0, bottom: mapBottom, left: 0 });
      }
    };
    publish();
    const unsubscribe = useMapStore.subscribe(publish);
    return () => {
      unsubscribe();
      useMapStore.getState().setMapPadding({ top: 0, right: 0, bottom: 0, left: 0 });
    };
  }, [mapBottom]);

  const shift = (step: 1 | -1) => {
    const index = SNAP_ORDER.indexOf(snap) + step;
    onSnapChange(SNAP_ORDER[Math.min(SNAP_ORDER.length - 1, Math.max(0, index))] ?? snap);
  };

  const onHandleKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      shift(1);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      shift(-1);
    }
  };

  const onRegionKey = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape' && !event.defaultPrevented && snap !== 'peek') {
      event.stopPropagation();
      shift(-1);
    }
  };

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    drag.current = { y: event.clientY, t: event.timeStamp };
  };
  const onPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const start = drag.current;
    drag.current = null;
    if (!start) return;
    const elapsed = Math.max(1, event.timeStamp - start.t);
    const next = snapFromDrag(snap, start.y, event.clientY, (event.clientY - start.y) / elapsed);
    if (next !== snap) onSnapChange(next);
    else if (Math.abs(event.clientY - start.y) < 10) onSnapChange(snap === 'peek' ? 'half' : 'peek');
  };

  return (
    <section
      aria-label={label}
      data-snap={snap}
      onKeyDown={onRegionKey}
      className={cn(
        'fixed inset-x-0 z-20 flex flex-col rounded-t-2xl border border-b-0 border-border bg-card shadow-lg',
        'transition-[height] duration-200 motion-reduce:transition-none',
      )}
      style={{ height, bottom: offset }}
    >
      <button
        type="button"
        aria-label={`${label}: ${snap === 'peek' ? 'expandir' : 'recolher'}`}
        aria-expanded={snap !== 'peek'}
        onKeyDown={onHandleKey}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          drag.current = null;
        }}
        className="flex min-h-11 w-full shrink-0 touch-none items-center justify-center rounded-t-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span aria-hidden className="h-1.5 w-10 rounded-full bg-muted-foreground/40" />
      </button>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">{children}</div>
    </section>
  );
}
