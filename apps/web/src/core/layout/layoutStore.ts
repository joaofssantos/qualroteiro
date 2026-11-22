import { create } from 'zustand';

import {
  LAYOUT_STORAGE_KEY,
  type LayoutId,
  buildDefaultLayout,
  isLayoutId,
  readStoredLayout,
} from './layoutConfig';

interface LayoutState {
  layout: LayoutId;
  setLayout(id: LayoutId): void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  layout: readStoredLayout() ?? buildDefaultLayout(),
  setLayout(id) {
    try {
      window.localStorage.setItem(LAYOUT_STORAGE_KEY, id);
    } catch {
      // storage indisponível: a troca vale só para esta sessão.
    }
    set({ layout: id });
  },
}));

// Mantém abas sincronizadas; valores inválidos são ignorados.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === LAYOUT_STORAGE_KEY && isLayoutId(event.newValue)) {
      useLayoutStore.setState({ layout: event.newValue });
    }
  });
}
