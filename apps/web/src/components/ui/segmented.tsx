import * as RadioGroup from '@radix-ui/react-radio-group';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface SegmentedOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

export interface SegmentedProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SegmentedOption[];
  'aria-label': string;
  className?: string;
}

/** Controle segmentado (grupo de rádio): setas navegam e selecionam. */
export function Segmented({ value, onValueChange, options, className, ...rest }: SegmentedProps) {
  return (
    <RadioGroup.Root
      value={value}
      onValueChange={onValueChange}
      aria-label={rest['aria-label']}
      orientation="horizontal"
      className={cn('inline-flex w-full items-center gap-1 rounded-lg bg-secondary p-1', className)}
    >
      {options.map((opt) => (
        <RadioGroup.Item
          key={opt.value}
          value={opt.value}
          className={cn(
            'inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 text-sm font-medium text-muted-foreground',
            'transition-colors motion-reduce:transition-none',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:pointer-events-none disabled:opacity-50',
            'data-[state=checked]:bg-card data-[state=checked]:text-primary data-[state=checked]:shadow-sm',
          )}
        >
          {opt.icon}
          {opt.label}
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}
