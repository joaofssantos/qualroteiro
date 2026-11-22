import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button } from './button';

describe('Button — alvo de toque no mobile', () => {
  it.each(['icon', 'sm'] as const)('variante %s chega a 44 px (h-11) abaixo de md', (size) => {
    render(
      <Button size={size} aria-label="x">
        x
      </Button>,
    );
    expect(screen.getByRole('button', { name: 'x' }).className).toMatch(/max-md:h-11/);
  });

  it('icon também alarga para w-11 no mobile', () => {
    render(<Button size="icon" aria-label="y" />);
    expect(screen.getByRole('button', { name: 'y' }).className).toMatch(/max-md:w-11/);
  });
});
