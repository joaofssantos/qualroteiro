import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './accordion';

function Sample() {
  return (
    <Accordion type="multiple" defaultValue={['a']}>
      <AccordionItem value="a">
        <AccordionTrigger>Resumo</AccordionTrigger>
        <AccordionContent>Conteúdo A</AccordionContent>
      </AccordionItem>
      <AccordionItem value="b">
        <AccordionTrigger>Pedágios</AccordionTrigger>
        <AccordionContent>Conteúdo B</AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

describe('Accordion', () => {
  it('trigger alterna aria-expanded e esconde o conteúdo', async () => {
    render(<Sample />);
    const a = screen.getByRole('button', { name: 'Resumo' });
    const b = screen.getByRole('button', { name: 'Pedágios' });
    expect(a).toHaveAttribute('aria-expanded', 'true');
    expect(b).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Conteúdo B')).not.toBeInTheDocument();
    await userEvent.click(b);
    expect(b).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Conteúdo B')).toBeInTheDocument();
    await userEvent.click(a);
    expect(screen.queryByText('Conteúdo A')).not.toBeInTheDocument();
  });
});
