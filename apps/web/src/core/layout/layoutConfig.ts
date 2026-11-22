export type LayoutId = 'a' | 'b';

export const LAYOUT_STORAGE_KEY = 'qualroteiro:layout';

export function isLayoutId(value: unknown): value is LayoutId {
  return value === 'a' || value === 'b';
}

/** Metadados de exibição (sem componentes: evita ciclo com os shells lazy). */
export const LAYOUT_META: Record<LayoutId, { label: string; description: string; livePreview: boolean }> = {
  a: {
    label: 'Mapa primeiro',
    description: 'O mapa ocupa a tela e o painel de consulta fica ao lado.',
    livePreview: false,
  },
  b: {
    label: 'Custos primeiro',
    description: 'Os custos vêm primeiro e o mapa acompanha a consulta ao vivo.',
    livePreview: true,
  },
};

/** Layout do build: `VITE_LAYOUT=a|b`; qualquer outro valor (ou ausência) cai em `a`. */
export function buildDefaultLayout(env: string | undefined = import.meta.env.VITE_LAYOUT): LayoutId {
  return isLayoutId(env) ? env : 'a';
}

/** Lê a escolha salva; inválida ou storage indisponível (Safari privado lança) → `null`. */
export function readStoredLayout(storage?: Storage): LayoutId | null {
  try {
    const target = storage ?? window.localStorage;
    const value = target.getItem(LAYOUT_STORAGE_KEY);
    return isLayoutId(value) ? value : null;
  } catch {
    return null;
  }
}

/** Ids registrados, na ordem de `LAYOUT_META` (a fonte única do registro). */
export function registeredLayoutIds(): LayoutId[] {
  return Object.keys(LAYOUT_META) as LayoutId[];
}

/** Escolha que aponta para um layout removido cai no primeiro registrado. */
export function resolveLayoutId(id: string, ids: readonly LayoutId[] = registeredLayoutIds()): LayoutId {
  return ids.find((candidate) => candidate === id) ?? ids[0] ?? 'a';
}
