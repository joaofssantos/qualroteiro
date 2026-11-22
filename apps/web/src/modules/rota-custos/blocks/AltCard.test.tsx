import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ALTERNATIVE_ROUTE } from '@/test/fixtures';

import { AltCard } from './AltCard';

describe('AltCard', () => {
  it('é um radio com o rótulo, o total e chama onSelect', async () => {
    const onSelect = vi.fn();
    render(<AltCard route={ALTERNATIVE_ROUTE} label="Mais barata" selected={false} onSelect={onSelect} />);
    const radio = screen.getByRole('radio', { name: /Mais barata/ });
    expect(radio).toHaveAttribute('aria-checked', 'false');
    expect(radio).toHaveTextContent('R$ 325,84');
    await userEvent.setup().click(radio);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
