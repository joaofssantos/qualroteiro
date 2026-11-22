import { useCallback, useState } from 'react';

export type SheetSnap = 'peek' | 'half' | 'full';

export const PEEK_HEIGHT = 96;
/** Espaço mínimo mantido livre no topo quando o sheet está em `full`. */
const FULL_TOP_GAP = 16;
/** Altura (px) do sheet para um snap, dado o `visualViewport.height`. */
export function sheetHeightFor(snap: SheetSnap, viewportHeight: number): number {
  if (snap === 'peek') return PEEK_HEIGHT;
  if (snap === 'half') return Math.round(viewportHeight * 0.5);
  return Math.max(PEEK_HEIGHT, viewportHeight - FULL_TOP_GAP);
}

export const SNAP_ORDER: readonly SheetSnap[] = ['peek', 'half', 'full'];

/** Arrasto mínimo (px) para trocar de altura sem "empurrão". */
export const DRAG_THRESHOLD = 60;
/** Velocidade mínima (px/ms) para um gesto rápido valer mesmo curto. */
export const FLICK_VELOCITY = 0.5;

/**
 * Altura de repouso após um arrasto (função pura). `velocity` em px/ms; negativa
 * = para cima. Sobe/desce no máximo um degrau por gesto.
 */
export function snapFromDrag(current: SheetSnap, startY: number, endY: number, velocity: number): SheetSnap {
  const delta = endY - startY; // positivo = para baixo
  let direction = 0;
  if (Math.abs(velocity) >= FLICK_VELOCITY) direction = velocity < 0 ? -1 : 1;
  else if (Math.abs(delta) >= DRAG_THRESHOLD) direction = delta < 0 ? -1 : 1;
  const index = SNAP_ORDER.indexOf(current) - direction; // para cima = próximo degrau
  return SNAP_ORDER[Math.min(SNAP_ORDER.length - 1, Math.max(0, index))] ?? current;
}

export function useSheetSnap(initial: SheetSnap = 'half') {
  const [snap, setSnap] = useState<SheetSnap>(initial);
  const next = useCallback(
    () => setSnap((s) => SNAP_ORDER[Math.min(SNAP_ORDER.length - 1, SNAP_ORDER.indexOf(s) + 1)] ?? s),
    [],
  );
  const prev = useCallback(() => setSnap((s) => SNAP_ORDER[Math.max(0, SNAP_ORDER.indexOf(s) - 1)] ?? s), []);
  return { snap, setSnap, next, prev };
}
