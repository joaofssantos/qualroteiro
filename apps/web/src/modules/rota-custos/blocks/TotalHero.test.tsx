import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TotalHero } from './TotalHero';

const base = { fuel: 90.07, toll: 29.2, km: 429.7, minutes: 343, liters: 42.97 };

describe('TotalHero', () => {
  it('soma combustível e pedágios', () => {
    render(<TotalHero {...base} unavailablePlazaIds={[]} />);
    expect(screen.getByTestId('total-hero')).toHaveTextContent('R$ 119,27');
    expect(screen.queryByText(/tarifa indisponível/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/parcial/i)).not.toBeInTheDocument();
  });

  it('com tarifa indisponível, avisa e trata o total como parcial', () => {
    render(<TotalHero {...base} unavailablePlazaIds={['p1', 'p2']} />);
    expect(screen.getByText('Tarifa indisponível em 2 praças')).toBeInTheDocument();
    expect(screen.getByText(/Total parcial:/)).toBeInTheDocument();
    expect(screen.getByTestId('total-hero')).toHaveTextContent('R$ 119,27');
  });

  it('usa o singular para uma praça', () => {
    render(<TotalHero {...base} unavailablePlazaIds={['p1']} />);
    expect(screen.getByText('Tarifa indisponível em 1 praça')).toBeInTheDocument();
  });
});
