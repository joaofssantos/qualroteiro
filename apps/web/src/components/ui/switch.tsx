import * as SwitchPrimitive from '@radix-ui/react-switch';
import { forwardRef } from 'react';

import { cn } from '@/lib/utils';

export const Switch = forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(function Switch({ className, ...props }, ref) {
  return (
    // Alvo de toque ≥ 44 px no botão; o trilho visual fica dentro dele.
    <SwitchPrimitive.Root
      ref={ref}
      className={cn(
        'group inline-flex h-11 w-14 shrink-0 items-center justify-center rounded-full',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          'flex h-6 w-11 items-center rounded-full bg-input p-0.5 transition-colors motion-reduce:transition-none',
          'group-data-[state=checked]:bg-primary',
        )}
      >
        <SwitchPrimitive.Thumb
          className={cn(
            'block h-5 w-5 rounded-full bg-card shadow transition-transform motion-reduce:transition-none',
            'data-[state=checked]:translate-x-5',
          )}
        />
      </span>
    </SwitchPrimitive.Root>
  );
});
