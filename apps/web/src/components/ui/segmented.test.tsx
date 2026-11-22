import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Segmented } from './segmented';

const options = [
  { value: 'car', label: 'Carro' },
  { value: 'truck', label: 'Caminhão' },
];

describe('Segmented', () => {
  it('chama onValueChange ao clicar numa opção', async () => {
    const onValueChange = vi.fn();
    render(<Segmented aria-label="Veículo" value="car" onValueChange={onValueChange} options={options} />);
    expect(screen.getByRole('radiogroup', { name: 'Veículo' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Caminhão' }));
    expect(onValueChange).toHaveBeenCalledWith('truck');
  });

  it('seta para a direita move a seleção', async () => {
    const onValueChange = vi.fn();
    render(<Segmented aria-label="Veículo" value="car" onValueChange={onValueChange} options={options} />);
    await userEvent.tab();
    // Radix move o foco via setTimeout e só seleciona se a seta ainda estiver
    // pressionada: segura a tecla até a seleção acontecer, depois solta.
    await userEvent.keyboard('{ArrowRight>}');
    await waitFor(() => expect(onValueChange).toHaveBeenCalledWith('truck'), { timeout: 3000 });
    await userEvent.keyboard('{/ArrowRight}');
  });
});
