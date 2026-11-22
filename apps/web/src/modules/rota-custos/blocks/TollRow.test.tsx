import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DUTRA_PLAZAS } from '@/test/fixtures';

import { TollRow } from './TollRow';

const plaza = DUTRA_PLAZAS[0]!;

describe('TollRow', () => {
  it('mostra o número da praça (índice + 1) e a tarifa do eixo', async () => {
    const onSelect = vi.fn();
    render(
      <ul>
        <TollRow index={2} plaza={plaza} axleCategory="car" unavailable={false} onSelect={onSelect} />
      </ul>,
    );
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText(plaza.name)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalledWith(plaza);
  });

  it('mostra "Valor não disponível" para praça indisponível', () => {
    render(
      <ul>
        <TollRow index={0} plaza={plaza} axleCategory="car" unavailable onSelect={() => {}} />
      </ul>,
    );
    expect(screen.getByText('Valor não disponível')).toBeInTheDocument();
  });
});
