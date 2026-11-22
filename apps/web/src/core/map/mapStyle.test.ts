import type { StyleSpecification } from 'maplibre-gl';
import { describe, expect, it } from 'vitest';

import { recolorStyle, roleOf } from './mapStyle';
import type { MapTheme } from './theme';

const THEME: MapTheme = {
  route: 'hsl(38 95% 58%)',
  casing: 'hsl(212 40% 6%)',
  routeAlt: 'hsl(210 14% 52%)',
  pins: {},
  base: {
    water: 'hsl(212 38% 14%)',
    land: 'hsl(212 16% 18%)',
    park: 'hsl(150 18% 20%)',
    road: 'hsl(212 12% 27%)',
    roadCasing: 'hsl(212 14% 10%)',
    roadMajor: 'hsl(212 14% 34%)',
    roadMajorCasing: 'hsl(212 14% 8%)',
    label: 'hsl(210 16% 72%)',
    labelHalo: 'hsl(212 20% 12%)',
  },
};

const STYLE = {
  version: 8,
  sources: {},
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#fff' } },
    { id: 'water', type: 'fill', source: 's', 'source-layer': 'water', paint: { 'fill-color': '#0af' } },
    { id: 'road_motorway', type: 'line', source: 's', 'source-layer': 'transportation', paint: { 'line-color': '#fa0' } },
    { id: 'road_motorway_casing', type: 'line', source: 's', 'source-layer': 'transportation', paint: { 'line-color': '#a50' } },
    { id: 'label_city', type: 'symbol', source: 's', 'source-layer': 'place', paint: { 'text-color': '#000' } },
    { id: 'highway-shield-us-interstate', type: 'symbol', source: 's', 'source-layer': 'transportation_name' },
    { id: 'boundary_2', type: 'line', source: 's', 'source-layer': 'boundary', paint: { 'line-color': '#999' } },
    { id: 'camada_nova_desconhecida', type: 'line', source: 's', 'source-layer': 'xyz', paint: { 'line-color': '#123' } },
  ],
} as unknown as StyleSpecification;

const byId = (s: StyleSpecification, id: string) => s.layers.find((l) => l.id === id)!;

describe('recolorStyle', () => {
  it('papéis seguem a tabela da F0', () => {
    expect(roleOf(byId(STYLE, 'road_motorway'))).toBe('road-major');
    expect(roleOf(byId(STYLE, 'road_motorway_casing'))).toBe('road-major');
    expect(roleOf(byId(STYLE, 'highway-shield-us-interstate'))).toBe('ignored');
    expect(roleOf(byId(STYLE, 'boundary_2'))).toBe('ignored');
  });

  it('no escuro troca as cores pelos tokens, com variante casing', () => {
    const out = recolorStyle(STYLE, THEME, 'dark');

    expect(byId(out, 'background').paint).toMatchObject({ 'background-color': 'hsl(212, 16%, 18%)' });
    expect(byId(out, 'water').paint).toMatchObject({ 'fill-color': 'hsl(212, 38%, 14%)' });
    expect(byId(out, 'road_motorway').paint).toMatchObject({ 'line-color': 'hsl(212, 14%, 34%)' });
    expect(byId(out, 'road_motorway_casing').paint).toMatchObject({ 'line-color': 'hsl(212, 14%, 8%)' });
    expect(byId(out, 'label_city').paint).toMatchObject({
      'text-color': 'hsl(210, 16%, 72%)',
      'text-halo-color': 'hsl(212, 20%, 12%)',
    });
  });

  it('não altera camada desconhecida nem a entrada', () => {
    const copy = JSON.stringify(STYLE);
    const out = recolorStyle(STYLE, THEME, 'dark');

    expect(byId(out, 'camada_nova_desconhecida')).toEqual(byId(STYLE, 'camada_nova_desconhecida'));
    expect(byId(out, 'boundary_2')).toEqual(byId(STYLE, 'boundary_2'));
    expect(JSON.stringify(STYLE)).toBe(copy);
  });

  it('escudos de rodovia (ícone do sprite, não recolorível) são escondidos no escuro', () => {
    const out = recolorStyle(STYLE, THEME, 'dark');
    expect(byId(out, 'highway-shield-us-interstate').layout).toMatchObject({ visibility: 'none' });
  });

  it('no claro devolve o estilo original', () => {
    expect(recolorStyle(STYLE, THEME, 'light')).toEqual(STYLE);
  });

  it('se a recoloração falhar devolve o estilo original', () => {
    const broken = { ...THEME, base: undefined } as unknown as MapTheme;
    expect(recolorStyle(STYLE, broken, 'dark')).toBe(STYLE);
  });
});
