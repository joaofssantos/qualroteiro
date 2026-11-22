import { cleanup, render, screen, within } from '@testing-library/react';
import { Map as MapIcon } from 'lucide-react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { TabBar } from './TabBar';
import type { ModuleNavItem } from '../../shared/moduleNav';

const items: ModuleNavItem[] = ['Rota & Custos', 'Planejamento', 'Hospedagem', 'Restaurantes', 'Atividades'].map(
  (label, i) => ({ id: `m${i}`, label, path: `/m${i}`, Icon: MapIcon, isActive: i === 1 }),
);

afterEach(cleanup);

describe('TabBar', () => {
  it('has one link per module, each ≥ 56 px tall, with unique names', () => {
    render(
      <MemoryRouter initialEntries={['/m1']}>
        <TabBar items={items} />
      </MemoryRouter>,
    );
    const nav = screen.getByRole('navigation', { name: 'Módulos' });
    const links = within(nav).getAllByRole('link');

    expect(links).toHaveLength(5);
    expect(new Set(links.map((l) => l.textContent)).size).toBe(5);
    for (const link of links) expect(link.className).toMatch(/min-h-14/);
    expect(within(nav).getByRole('link', { name: 'Planejamento' })).toHaveAttribute('aria-current', 'page');
  });
});
