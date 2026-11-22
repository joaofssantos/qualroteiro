import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ALTERNATIVE_ROUTE, DUTRA_ROUTE } from '@/test/fixtures';

import { CompareTable } from './CompareTable';

afterEach(cleanup);

describe('CompareTable', () => {
  it('mostra uma linha por alternativa, destaca o menor total e marca a selecionada', () => {
    render(
      <CompareTable
        routes={[DUTRA_ROUTE, ALTERNATIVE_ROUTE]}
        labels={['Mais rápida', 'Alternativa 2']}
        selectedIndex={0}
        onSelect={vi.fn()}
      />,
    );

    const rows = within(screen.getByRole('table', { name: 'Comparação de alternativas' })).getAllByRole('row');
    expect(rows).toHaveLength(3); // cabeçalho + 2
    expect(rows[1]).toHaveAttribute('aria-selected', 'true');
    expect(rows[2]).toHaveAttribute('aria-selected', 'false');
    // 257,82 + 52,90 = 310,72 < 307,44 + 18,40 = 325,84
    expect(within(rows[1]!).getByText('Menor total')).toBeInTheDocument();
    expect(within(rows[2]!).queryByText('Menor total')).not.toBeInTheDocument();
  });

  it('clicar na linha chama onSelect com o índice; o botão da linha faz o mesmo por teclado', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <CompareTable
        routes={[DUTRA_ROUTE, ALTERNATIVE_ROUTE]}
        labels={['Mais rápida', 'Alternativa 2']}
        selectedIndex={0}
        onSelect={onSelect}
      />,
    );

    await user.click(screen.getAllByRole('row')[2]!);
    expect(onSelect).toHaveBeenLastCalledWith(1);

    screen.getByRole('button', { name: 'Selecionar Alternativa 2' }).focus();
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it('uma só alternativa e tarifa ausente não quebram: total parcial, sem destaque indevido', () => {
    const partial = {
      ...DUTRA_ROUTE,
      tolls: { ...DUTRA_ROUTE.tolls, total: 0, unavailablePlazaIds: [DUTRA_ROUTE.tolls.plazas[0]!.id] },
    };
    render(
      <CompareTable routes={[partial]} labels={['Rota recomendada']} selectedIndex={0} onSelect={vi.fn()} />,
    );

    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.getByText('Total parcial')).toBeInTheDocument();
    expect(screen.queryByText('Menor total')).not.toBeInTheDocument();
  });
});
