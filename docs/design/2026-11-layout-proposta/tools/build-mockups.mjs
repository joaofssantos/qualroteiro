// Generates the static mockup pages (no framework, no network). Run: node tools/build-mockups.mjs
import fs from 'node:fs';
const OUT = new URL('../mockups/', import.meta.url).pathname;
const ic = (n, c = '') => `<span data-i="${n}" data-ic="${c}" style="display:inline-flex"></span>`;
const head = (title, css) => `<!doctype html><html lang="pt-BR" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — Qual roteiro · proposta de layout</title><link rel="stylesheet" href="assets/tokens.css"><link rel="stylesheet" href="assets/kit.css"><link rel="stylesheet" href="assets/${css}.css"></head>`;
const foot = `<script src="assets/mock.js"></script></html>`;

const TOLLS = [
  ['Arujá', 'CCR RioSP · BR-116 · km 204', '9,20'], ['Jacareí', 'CCR RioSP · BR-116 · km 160', '6,80'],
  ['Moreira César', 'CCR RioSP · BR-116 · km 145', '5,30'], ['Aparecida', 'CCR RioSP · BR-116 · km 78', '4,80'],
  ['Itatiaia', 'CCR RioSP · BR-116 · km 322', '11,50'], ['Viúva Graça', 'CCR RioSP · BR-116 · km 218', '15,30'],
];
const tollList = (cur = 0) => `<ul class="tolls" aria-label="Praças de pedágio">${TOLLS.map(([n, s, v], i) =>
  `<li class="toll" ${cur === i + 1 ? 'aria-current="true"' : ''}><span class="n">${i + 1}</span><span><span class="nm">${n}</span><br><span class="sub">${s}</span></span><span class="v">R$ ${v}</span></li>`).join('')}</ul>`;
const bar = `<div class="bar" role="img" aria-label="Combustível 83%, pedágios 17%"><span class="f" style="width:83%"></span><span class="t" style="width:17%"></span></div>`;

const modules = [['route', 'Rota & Custos', 'route', '--mod-route'], ['plan', 'Planejar', 'calendar', '--mod-plan'], ['stay', 'Hospedagem', 'bed', '--mod-stay'], ['act', 'Atividades', 'ticket', '--mod-act'], ['food', 'Restaurantes', 'utensils', '--mod-food']];
const nav = (cls) => modules.map(([id, l, i, v], k) => `<a class="${cls}" href="#" ${k === 0 ? 'aria-current="page"' : ''} style="--mod:var(${v})"><span class="ic" style="--mod:var(${v});color:hsl(var(${v}))">${ic(i)}</span><span>${l}</span></a>`).join('');

/* ---------- Direction A ---------- */
const vehicle = `<div class="field"><span class="lbl">Veículo</span><div class="seg" role="group" aria-label="Tipo de veículo">
 <button aria-pressed="true">${ic('car')}Carro</button><button aria-pressed="false">${ic('moto')}Moto</button><button aria-pressed="false">${ic('bus')}Ônibus</button><button aria-pressed="false">${ic('truck')}Caminhão</button></div></div>`;
const formA = `
<div class="head"><h1>Quanto custa essa viagem?</h1></div>
<div class="scroll"><form class="stack" onsubmit="return false">
 <div class="trip"><div class="rail"><i></i><b></b><em></em></div>
  <div class="fields"><div class="input">${ic('pin')}<input aria-label="Origem" placeholder="Origem — cidade, estado ou endereço" value="São Paulo, SP"></div>
   <div class="input">${ic('pin')}<input aria-label="Destino" placeholder="Destino — cidade, estado ou endereço" value="Rio de Janeiro, RJ"></div></div>
  <button class="btn btn-ghost btn-icon" type="button" aria-label="Inverter origem e destino" style="align-self:center">${ic('swap')}</button></div>
 <button class="btn btn-ghost btn-sm" type="button" style="align-self:flex-start;margin:-8px 0 0 -4px">${ic('plus','sm')} Adicionar parada</button>
 ${vehicle}
 <div class="row2"><div class="field"><label>Eixos (pedágio)</label><div class="input"><select aria-label="Eixos"><option>2 eixos · simples</option><option>3 eixos</option></select></div></div>
  <div class="field"><label>Consumo</label><div class="input"><input class="num" value="10" inputmode="decimal"><span class="unit">km/L</span></div></div></div>
 <div class="row2"><div class="field"><label>Combustível</label><div class="input"><span class="unit">R$</span><input class="num" value="6,00" inputmode="decimal"><span class="unit">/L</span></div></div>
  <div class="field"><label>Ida e volta</label><div style="display:flex;align-items:center;gap:10px;min-height:44px"><button class="switch" role="switch" aria-checked="false" aria-label="Calcular volta"></button><span class="muted">Calcular volta</span></div></div></div>
 <details class="acc"><summary>${ic('tune')} Opções de trajeto <span class="chev sum">${ic('chev')}</span></summary><div class="body" style="display:flex;gap:8px;flex-wrap:wrap"><button class="chip" aria-pressed="false">Evitar pedágios</button><button class="chip" aria-pressed="false">Evitar balsas</button><button class="chip" aria-pressed="true">Mostrar postos</button></div></details>
 <a class="btn btn-accent btn-block" href="a-resultado.html" style="min-height:52px;font-size:16px">Calcular rota ${ic('right')}</a>
 <p class="note">Valores de pedágio vêm da base da ANTT; confira a tarifa antes de viajar.</p>
</form></div>`;

const resultA = (cur = 0) => `
<span class="handle" data-sheet-set="half" role="button" aria-label="Ajustar altura do painel"><i></i></span>
<div class="scroll"><div class="stack">
 <div class="qsum"><span style="color:hsl(var(--pin-origin))">${ic('route')}</span><span class="t"><b>São Paulo → Rio de Janeiro</b><span class="sub muted">Carro · 2 eixos · 10 km/L · R$ 6,00/L</span></span><a class="btn btn-ghost btn-sm btn-icon" href="a-consulta.html" aria-label="Editar consulta">${ic('pencil')}</a></div>
 <div class="alts" role="group" aria-label="Alternativas de rota">
  <button class="alt" aria-pressed="true"><small>Mais rápida</small><b class="num">5 h 43</b><span class="num">R$ 310,72</span></button>
  <button class="alt" aria-pressed="false"><small>Equilibrada</small><b class="num">5 h 52</b><span class="num">R$ 291,92</span></button>
  <button class="alt" aria-pressed="false"><small>Sem pedágio</small><b class="num">7 h 10</b><span class="num">R$ 286,56</span></button></div>
 <section class="hero" aria-label="Custo total"><div class="lbl muted">Custo total estimado</div><div class="money">R$ 310,72</div>${bar.replace('class="bar"','class="bar" style="margin-top:10px"')}
  <div class="legend"><span><i class="dot f"></i>Combustível <b class="num">R$ 257,82</b></span><span><i class="dot t"></i>Pedágios <b class="num">R$ 52,90</b></span></div>
  <div class="meta"><span>${ic('ruler','sm')}429,7 km</span><span>${ic('clock','sm')}5 h 43 min</span><span>${ic('fuel','sm')}43 L</span></div></section>
 <div class="actions only-peek"><a class="btn btn-accent" href="#">${ic('bookmark')} Salvar na viagem</a><button class="btn btn-outline btn-icon" aria-label="Compartilhar">${ic('share')}</button></div>
 <div class="more"><details class="acc" open><summary>${ic('coins')} Pedágios · 6 praças <span class="sum num">R$ 52,90</span><span class="chev">${ic('chev')}</span></summary><div class="body">${tollList(cur)}
   <p class="note">Tarifa para 2 eixos, categoria carro. Praças sem tarifa cadastrada aparecem como “não disponível”.</p></div></details>
 <details class="acc"><summary>${ic('fuel')} Combustível <span class="sum num">R$ 257,82</span><span class="chev">${ic('chev')}</span></summary><div class="body"><dl class="kv"><dt class="muted">Distância</dt><dd>429,7 km</dd><dt class="muted">Consumo</dt><dd>10 km/L</dd><dt class="muted">Litros</dt><dd>43,0 L</dd><dt class="muted">Preço</dt><dd>R$ 6,00/L</dd></dl></div></details>
 <details class="acc"><summary>${ic('layers')} Pontos no mapa <span class="chev sum">${ic('chev')}</span></summary><div class="body" style="display:flex;flex-direction:column;gap:12px"><label style="display:flex;justify-content:space-between;align-items:center">Pedágios <button class="switch" role="switch" aria-checked="true"></button></label><label style="display:flex;justify-content:space-between;align-items:center">Postos de combustível <button class="switch" role="switch" aria-checked="false"></button></label></div></details>
 <div class="actions" style="margin-top:8px"><a class="btn btn-accent" href="#">${ic('bookmark')} Salvar na viagem</a><button class="btn btn-outline btn-icon" aria-label="Compartilhar">${ic('share')}</button></div></div>
</div></div>`;

const popA = `<div class="pop" role="dialog" aria-label="Praça Itatiaia"><div style="display:flex;justify-content:space-between;gap:8px"><div><h3>Itatiaia</h3><div class="sub muted" style="font-size:12px">CCR RioSP · BR-116 · km 322</div></div><button class="btn btn-ghost btn-sm btn-icon" aria-label="Fechar">${ic('x')}</button></div>
 <table><tr class="sel"><td>2 eixos (sua seleção)</td><td>R$ 11,50</td></tr><tr><td>Moto</td><td>R$ 5,75</td></tr><tr><td>3 eixos</td><td>R$ 17,25</td></tr><tr><td>4 eixos</td><td>R$ 23,00</td></tr></table>
 <p class="note" style="margin-top:8px">Fonte: ANTT · tarifa vigente informada pela concessionária.</p></div>`;

function pageA(file, title, panel, map, extra = '', sheet = 'half', mobileChip = true) {
  return head(title, 'a') + `<body><div class="app">
<nav class="rail" aria-label="Módulos"><a class="logo" href="index.html" aria-label="Qual roteiro"><span>q<b>r</b></span></a>${nav('nav')}<span class="sp"></span>
 <button class="nav desk" data-theme-toggle></button><button class="nav desk" aria-label="Conta"><span class="ic">${ic('user')}</span><span>Conta</span></button></nav>
<main class="stage"><div class="map" data-pad="a" ${map}></div>
 ${mobileChip ? `<div class="topchip"><span style="color:hsl(var(--pin-origin))">${ic('route')}</span><b>São Paulo → Rio de Janeiro</b><button class="btn btn-ghost btn-sm btn-icon" data-theme-toggle></button></div>` : `<div class="topchip"><b>Nova consulta</b><button class="btn btn-ghost btn-sm btn-icon" data-theme-toggle></button></div>`}
 <section class="panel" data-sheet="${sheet}" aria-label="Painel">${panel}</section>
 <button class="panel-toggle" aria-label="Recolher painel">${ic('left')}</button>${extra}</main></div>${foot}`;
}
fs.writeFileSync(OUT + 'a-consulta.html', pageA('a-consulta', 'A · Consulta', formA, 'data-map="pins"', '', 'full', false));
fs.writeFileSync(OUT + 'a-resultado.html', pageA('a-resultado', 'A · Resultado', resultA(), 'data-map="route" data-alt'));
fs.writeFileSync(OUT + 'a-praca.html', pageA('a-praca', 'A · Praça de pedágio', resultA(5), 'data-map="route" data-focus="5" data-alt', popA));

/* ---------- Direction B ---------- */
const topB = `<header class="top"><a class="logo" href="index.html">qual<b>roteiro</b></a><nav class="tabs" aria-label="Módulos">${modules.map(([id, l, i, v], k) => `<a href="#" ${k === 0 ? 'aria-current="page"' : ''} style="--mod:var(${v})"><span class="ic" style="color:hsl(var(${v}))">${ic(i)}</span>${l}</a>`).join('')}</nav><span class="sp"></span>
 <button class="btn btn-ghost btn-icon" data-theme-toggle></button><button class="btn btn-ghost btn-icon" aria-label="Conta">${ic('user')}</button></header>`;
const consultaB = head('B · Consulta', 'b') + `<body>${topB}<main class="hero-b"><div class="map" data-map="idle" data-ctl="off" aria-hidden="true"></div><div class="in">
 <h1>Quanto custa essa viagem?</h1><p class="lead">Distância, tempo, pedágios por praça e combustível — num só lugar, antes de sair de casa.</p>
 <form class="search" onsubmit="return false"><div class="grid">
  <div class="field"><label>Origem</label><div class="input">${ic('pin')}<input value="São Paulo, SP" aria-label="Origem"></div></div>
  <button class="btn btn-ghost btn-icon" type="button" aria-label="Inverter" style="align-self:end">${ic('swap')}</button>
  <div class="field"><label>Destino</label><div class="input">${ic('pin')}<input value="Rio de Janeiro, RJ" aria-label="Destino"></div></div>
  <div class="field"><label>Veículo</label><div class="input"><select aria-label="Veículo"><option>Carro · 2 eixos</option><option>Moto</option><option>Caminhão</option></select></div></div>
  <div class="field"><label>Consumo</label><div class="input"><input class="num" value="10"><span class="unit">km/L</span></div></div>
  <div class="field"><label>Combustível</label><div class="input"><span class="unit">R$</span><input class="num" value="6,00"></div></div>
  <a class="btn btn-accent full" href="b-resultado.html" style="min-height:44px">Calcular ${ic('right')}</a></div>
  <div class="sub"><button class="chip" aria-pressed="false">${ic('plus','sm')} Parada</button><label><button class="switch" role="switch" aria-checked="false" aria-label="Calcular volta"></button> Calcular volta</label><label><button class="switch" role="switch" aria-checked="false" aria-label="Evitar pedágios"></button> Evitar pedágios</label></div></form>
 <h2 style="font-size:14px;margin:28px 0 10px;color:hsl(var(--text-muted))">Consultas recentes</h2>
 <div style="display:flex;gap:12px;flex-wrap:wrap">${['São Paulo → Curitiba · R$ 211,40', 'São Paulo → Campinas · R$ 48,90', 'Rio de Janeiro → Búzios · R$ 98,10'].map(t => `<a class="chip" href="b-resultado.html" style="min-height:40px;text-decoration:none">${ic('clock','sm')} ${t}</a>`).join('')}</div>
</div></main>${foot}`;
const resultB = (focus = 0) => head('B · Resultado', 'b') + `<body>${topB}<main class="wrap">
 <div class="qbar"><div class="qsum"><span style="color:hsl(var(--pin-origin))">${ic('route')}</span><span class="t"><b>São Paulo, SP → Rio de Janeiro, RJ</b><span class="muted" style="font-size:12px">Carro · 2 eixos · 10 km/L · R$ 6,00/L</span></span><a class="btn btn-ghost btn-sm" href="b-consulta.html">${ic('pencil','sm')} Editar</a></div>
  <button class="btn btn-outline">${ic('share')} Compartilhar</button><a class="btn btn-accent" href="#">${ic('bookmark')} Salvar na viagem</a></div>
 <section class="kpis" aria-label="Resumo">
  <div class="kpi main"><div class="lbl">Custo total</div><span class="money">R$ 310,72</span><small>combustível + pedágios · só ida</small></div>
  <div class="kpi"><div class="lbl" style="color:hsl(var(--cost-fuel))">${ic('fuel','sm')} Combustível</div><span class="money">R$ 257,82</span><small>43,0 L · 10 km/L</small></div>
  <div class="kpi"><div class="lbl" style="color:hsl(var(--cost-toll))">${ic('coins','sm')} Pedágios</div><span class="money">R$ 52,90</span><small>6 praças · 2 eixos</small></div>
  <div class="kpi"><div class="lbl muted">${ic('clock','sm')} Tempo · distância</div><span class="money">5 h 43</span><small>429,7 km · via Rod. Presidente Dutra</small></div></section>
 <div class="grid-b"><div class="mapcard"><div class="map" data-map="route" data-alt ${focus ? `data-focus="${focus}"` : ''}></div>${focus ? popB : ''}<button class="btn btn-outline btn-sm" style="position:absolute;left:12px;top:12px;z-index:2">${ic('layers','sm')} Camadas</button></div>
  <section class="card sidecard"><h2>${ic('coins')} Pedágios por praça <span class="tag" style="margin-left:auto">2 eixos</span></h2>${tollList(focus)}<p class="note">Fonte: ANTT. Confirme a tarifa antes de viajar.</p></section></div>
 <section class="card cmp"><h2>${ic('route')} Comparar alternativas</h2><table class="t respo"><thead><tr><th>Rota</th><th>Tempo</th><th>Distância</th><th>Combustível</th><th>Pedágios</th><th>Total</th></tr></thead><tbody>
  <tr class="sel"><td><b>Mais rápida</b> <span class="tag">selecionada</span></td><td>5 h 43</td><td>429,7 km</td><td>R$ 257,82</td><td>R$ 52,90</td><td><b>R$ 310,72</b></td></tr>
  <tr><td><b>Equilibrada</b></td><td>5 h 52</td><td>418,2 km</td><td>R$ 250,92</td><td>R$ 41,00</td><td><b>R$ 291,92</b></td></tr>
  <tr class="best"><td><b>Sem pedágio</b> <span class="tag good">mais barata</span></td><td>7 h 10</td><td>477,6 km</td><td>R$ 286,56</td><td>R$ 0,00</td><td><b>R$ 286,56</b></td></tr></tbody></table></section>
</main><div class="stickybar"><div class="tot"><small>Custo total</small><span class="money">R$ 310,72</span></div><a class="btn btn-accent" href="#">${ic('bookmark')} Salvar</a></div>${foot}`;
var popB = `<div class="pop" role="dialog" aria-label="Praça Itatiaia"><div style="display:flex;justify-content:space-between;gap:8px"><div><h3 style="font-size:15px">Itatiaia</h3><div class="muted" style="font-size:12px">CCR RioSP · BR-116 · km 322</div></div><button class="btn btn-ghost btn-sm btn-icon" aria-label="Fechar">${ic('x')}</button></div><p class="money" style="font-size:22px;margin-top:8px">R$ 11,50 <span class="muted" style="font-size:12px;font-weight:600">2 eixos</span></p></div>`;
fs.writeFileSync(OUT + 'b-consulta.html', consultaB);
fs.writeFileSync(OUT + 'b-resultado.html', resultB());
fs.writeFileSync(OUT + 'b-praca.html', resultB(5));

/* ---------- Hub ---------- */
const links = [['A — Mapa-primeiro (recomendada)', [['a-consulta', 'Consulta'], ['a-resultado', 'Resultado'], ['a-praca', 'Praça de pedágio']]], ['B — Custos em primeiro plano (alternativa)', [['b-consulta', 'Consulta'], ['b-resultado', 'Resultado'], ['b-praca', 'Praça de pedágio']]]];
fs.writeFileSync(OUT + 'index.html', head('Hub', 'b') + `<body><main class="wrap" style="max-width:820px"><div style="display:flex;justify-content:space-between;align-items:center"><h1 style="font-size:28px">Qual roteiro · proposta de layout (nov/2026)</h1><button class="btn btn-outline btn-icon" data-theme-toggle></button></div>
<p class="muted" style="margin:8px 0 24px">Mockups estáticos e responsivos (redimensione a janela: ≥768 px desktop, abaixo mobile). Dados fictícios; mapa ilustrativo original. Tema pelo botão ou <code>?theme=dark</code>; no mobile, <code>?sheet=peek|half|full</code>.</p>
${links.map(([t, l]) => `<section class="card" style="padding:20px;margin-bottom:16px"><h2 style="font-size:18px;margin-bottom:12px">${t}</h2><div style="display:flex;gap:8px;flex-wrap:wrap">${l.map(([f, n]) => `<a class="btn btn-outline" href="${f}.html">${n}</a><a class="btn btn-ghost" href="${f}.html?theme=dark">${n} (escuro)</a>`).join('')}</div></section>`).join('')}</main>${foot}`);
console.log('ok');
