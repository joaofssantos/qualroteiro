/* Mockup helpers: icons, illustrative map (no tiles, original artwork), theme + state toggles. */
const P = {
  route:'<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.5"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  bed:'<path d="M3 18V6M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="1.5"/>',
  ticket:'<path d="M3 9a2 2 0 0 0 0 6v3h18v-3a2 2 0 0 1 0-6V6H3z"/><path d="M13 6v12" stroke-dasharray="2 2"/>',
  utensils:'<path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10M17 21V3c-2 2-3 5-3 8h3"/>',
  moon:'<path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10z"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  swap:'<path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  pencil:'<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  chev:'<path d="M6 9l6 6 6-6"/>',
  right:'<path d="M9 6l6 6-6 6"/>',
  left:'<path d="M15 6l-6 6 6 6"/>',
  car:'<path d="M5 16l1.5-5.5A2 2 0 0 1 8.4 9h7.2a2 2 0 0 1 1.9 1.5L19 16M4 16h16v3H4z"/><circle cx="7.5" cy="17.5" r=".6"/><circle cx="16.5" cy="17.5" r=".6"/>',
  moto:'<circle cx="5.5" cy="16" r="3"/><circle cx="18.5" cy="16" r="3"/><path d="M8 16l3-6h4l3.5 6M11 10L9 7H7"/>',
  bus:'<rect x="4" y="3" width="16" height="15" rx="2"/><path d="M4 11h16M7 21v-3M17 21v-3"/>',
  truck:'<path d="M2 6h11v10H2zM13 9h4l3 3v4h-7"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  fuel:'<path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h12M14 10h2a2 2 0 0 1 2 2v4a1.5 1.5 0 0 0 3 0V8l-3-3"/><path d="M6 8h6"/>',
  coins:'<circle cx="9" cy="9" r="6"/><path d="M15 9.5a6 6 0 1 1-5 5.5"/><path d="M9 6.5v5M7.5 8h2.5a1 1 0 0 1 0 2H8"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  ruler:'<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>',
  save:'<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  bookmark:'<path d="M6 3h12v18l-6-4-6 4z"/>',
  share:'<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6"/>',
  layers:'<path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  x:'<path d="M6 6l12 12M18 6L6 18"/>',
  pin:'<path d="M12 21s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  panel:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  tune:'<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  check:'<path d="M5 12l5 5 9-10"/>',
  crosshair:'<circle cx="12" cy="12" r="8"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
};
window.icon = (n, c='') => `<svg class="i ${c}" viewBox="0 0 24 24" aria-hidden="true">${P[n]||''}</svg>`;
document.querySelectorAll('[data-i]').forEach(el => el.insertAdjacentHTML('afterbegin', icon(el.dataset.i, el.dataset.ic||'')));

/* ---- theme: ?theme=dark or toggle ---- */
const q = new URLSearchParams(location.search);
const saved = q.get('theme') || localStorage.getItem('qr-mock-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
document.documentElement.dataset.theme = saved;
document.querySelectorAll('[data-theme-toggle]').forEach(b => {
  const sync = () => { b.innerHTML = icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon'); b.setAttribute('aria-label', document.documentElement.dataset.theme === 'dark' ? 'Tema claro' : 'Tema escuro'); };
  sync();
  b.addEventListener('click', () => { const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = t; localStorage.setItem('qr-mock-theme', t); sync(); });
});

/* ---- illustrative map: original SVG, tokens only. data-map="idle|route", data-focus=toll index ---- */
const TOLLS = [[300,452],[352,428],[410,404],[470,378],[560,330],[690,300]]; // route positions of the 6 plazas
const ROUTE = 'M220 500 C260 480 300 462 340 440 S430 396 480 372 S560 326 600 312 S690 296 740 306 S800 330 830 346';
window.renderMap = (el) => {
  const mode = el.dataset.map, focus = +el.dataset.focus || 0, alt = el.dataset.alt !== undefined;
  const label = (x,y,t,s=15,w=600) => `<text x="${x}" y="${y}" font-size="${s}" font-weight="${w}" fill="hsl(var(--map-label))" stroke="hsl(var(--map-label-halo))" stroke-width="4" paint-order="stroke" font-family="Inter,system-ui,sans-serif">${t}</text>`;
  const pin = (x,y,fill,txt='') => `<g transform="translate(${x} ${y})"><circle r="11" fill="hsl(${fill})" stroke="hsl(var(--pin-ring))" stroke-width="3"/>${txt?`<text y="4" text-anchor="middle" font-size="11" font-weight="800" fill="hsl(var(--pin-ring))" font-family="Inter,sans-serif">${txt}</text>`:''}</g>`;
  const mob = matchMedia('(max-width:767px)').matches, padA = el.dataset.pad === 'a';
  const vb = padA ? (mob ? '120 210 800 400' : '0 0 1100 760') : '0 0 1100 760';
  const par = padA && mob ? 'xMidYMid meet' : 'xMidYMid slice';
  const sty = padA && mob ? 'style="margin-top:64px;height:calc(100% - 64px);overflow:visible"' : '';
  let s = `<svg viewBox="${vb}" preserveAspectRatio="${par}" ${sty} role="img" aria-label="Mapa ilustrativo">
  <rect x="-2000" y="-2000" width="5200" height="4800" fill="hsl(var(--map-land))"/>
  <g ${padA && !mob ? 'transform="translate(190 0)"' : ''}>
  <path d="M-2000 640 H0 V900 H-2000Z M1100 500 H3000 V900 H1100Z" fill="hsl(var(--map-water))"/>
  <path d="M0 640 C120 600 210 650 300 610 S470 560 560 600 S760 660 860 560 S1010 470 1100 500 V760 H0Z" fill="hsl(var(--map-water))"/>
  <path d="M580 120 C650 90 760 110 800 170 S760 250 690 240 S560 190 580 120Z" fill="hsl(var(--map-park))"/>
  <path d="M120 260 C180 210 280 220 320 270 S300 350 220 350 S90 310 120 260Z" fill="hsl(var(--map-park))"/>
  <path d="M900 380 C960 350 1040 380 1050 440 S980 520 920 480 S860 410 900 380Z" fill="hsl(var(--map-park))"/>
  <g fill="none" stroke="hsl(var(--map-road))" stroke-width="5" stroke-linecap="round">
   <path d="M0 330 C200 310 380 340 520 250 S820 190 1100 230"/><path d="M180 760 C220 600 330 500 400 330 S520 100 560 0"/>
   <path d="M0 460 C160 430 300 520 470 500 S760 420 1100 420"/><path d="M700 760 C720 600 760 440 840 300 S980 100 1030 0"/></g>
  <g fill="none" stroke="hsl(var(--map-road-major))" stroke-width="8" stroke-linecap="round"><path d="M0 560 C240 520 420 470 600 380 S900 250 1100 270"/></g>
  ${label(150,540,'São Paulo',17,700)}${label(780,278,'Resende',14)}${label(900,372,'Volta Redonda',13)}${label(420,350,'Taubaté',13)}${label(830,395,'Rio de Janeiro',16,700)}${label(560,688,'Oceano Atlântico',13,500)}${label(300,300,'Campinas',13)}`;
  if (mode === 'route') {
    s += `${alt ? `<path d="M220 500 C300 540 420 520 520 470 S700 380 740 380 S800 370 830 346" fill="none" stroke="hsl(var(--route-alt))" stroke-width="5" stroke-dasharray="2 9" stroke-linecap="round"/>` : ''}
    <path d="${ROUTE}" fill="none" stroke="hsl(var(--route-casing))" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>
    <path d="${ROUTE}" fill="none" stroke="hsl(var(--route))" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`;
    TOLLS.forEach(([x,y],i) => { s += (focus === i+1) ? `<g transform="translate(${x} ${y})"><circle r="20" fill="hsl(var(--pin-toll)/.25)"/><circle r="13" fill="hsl(var(--pin-toll))" stroke="hsl(var(--pin-ring))" stroke-width="3"/><text y="4" text-anchor="middle" font-size="12" font-weight="800" fill="hsl(var(--pin-ring))" font-family="Inter,sans-serif">${i+1}</text></g>` : pin(x,y,'var(--pin-toll)',i+1); });
    s += pin(224,498,'var(--pin-origin)') + `<g transform="translate(830 346)"><rect x="-11" y="-11" width="22" height="22" rx="6" fill="hsl(var(--pin-dest))" stroke="hsl(var(--pin-ring))" stroke-width="3"/></g>`;
  } else if (mode === 'pins') {
    s += pin(224,498,'var(--pin-origin)') + `<g transform="translate(830 346)"><rect x="-11" y="-11" width="22" height="22" rx="6" fill="hsl(var(--pin-dest))" stroke="hsl(var(--pin-ring))" stroke-width="3"/></g>`;
  }
  s += '</g>';
  el.innerHTML = s + '</svg>' + (el.dataset.ctl !== 'off' ? `<div class="ctl"><button aria-label="Aproximar">${icon('plus')}</button><button aria-label="Afastar">${icon('x').replace('M6 6l12 12M18 6L6 18','M5 12h14')}</button></div>` : '') + '<span class="attr">Mapa ilustrativo · dados fictícios</span>';
};
document.querySelectorAll('[data-map]').forEach(window.renderMap);
let _w = innerWidth < 768; addEventListener('resize', () => { if ((innerWidth < 768) !== _w) { _w = innerWidth < 768; document.querySelectorAll('[data-map]').forEach(window.renderMap); } });

/* ---- generic [aria-pressed] segmented/chip groups + accordions are static; sheet state via ?sheet=peek|half|full ---- */
document.querySelectorAll('.seg').forEach(g => g.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; g.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); }));
document.querySelectorAll('.switch').forEach(b => b.addEventListener('click', () => b.setAttribute('aria-checked', b.getAttribute('aria-checked') !== 'true')));
const sheet = document.querySelector('[data-sheet]');
if (sheet) { sheet.dataset.sheet = q.get('sheet') || sheet.dataset.sheet; sheet.querySelectorAll('[data-sheet-set]').forEach(b => b.addEventListener('click', () => sheet.dataset.sheet = b.dataset.sheetSet)); }
