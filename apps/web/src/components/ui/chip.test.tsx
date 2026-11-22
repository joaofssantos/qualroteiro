import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Chip } from './chip';

describe('Chip', () => {
  it('renderiza o texto em cada tom', () => {
    render(
      <>
        <Chip>Neutro</Chip>
        <Chip tone="success">Mais barata</Chip>
        <Chip tone="warning">Atenção</Chip>
        <Chip tone="danger">Erro</Chip>
      </>,
    );
    for (const t of ['Neutro', 'Mais barata', 'Atenção', 'Erro']) {
      expect(screen.getByText(t)).toBeInTheDocument();
    }
  });
});
