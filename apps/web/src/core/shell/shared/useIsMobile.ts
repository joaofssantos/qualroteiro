import { useEffect, useState } from 'react';

/** Breakpoint mobile do plano: `< 768 px`. */
export const MOBILE_QUERY = '(max-width: 767px)';

function read(): boolean {
  return typeof window.matchMedia === 'function' ? window.matchMedia(MOBILE_QUERY).matches : false;
}

/** `true` abaixo de 768 px; acompanha redimensionamento. Sem `matchMedia` → desktop. */
export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(read);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setMobile(query.matches);
    onChange();
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return mobile;
}
