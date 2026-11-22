import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CostBar } from './CostBar';

describe('CostBar', () => {
  it('descreve os valores no rótulo acessível', () => {
    render(<CostBar fuel={90} toll={30} />);
    expect(screen.getByRole('img')).toHaveAccessibleName(
      /combustível R\$\s90,00.*pedágios R\$\s30,00/,
    );
  });

  it('não quebra com custos zerados', () => {
    render(<CostBar fuel={0} toll={0} />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });
});
