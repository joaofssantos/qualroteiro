import { cn } from '@/lib/utils';

export type ChipTone = 'neutral' | 'success' | 'warning' | 'danger';

// Tokens semânticos success/warning/danger chegam na F1; até lá usamos os
// tokens existentes (atividades = verde, accent = âmbar, destructive = vermelho).
const TONES: Record<ChipTone, string> = {
  neutral: 'bg-secondary text-secondary-foreground',
  success: 'bg-module-atividades/15 text-module-atividades',
  warning: 'bg-accent/20 text-foreground',
  danger: 'bg-destructive/15 text-destructive',
};

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: ChipTone;
}

export function Chip({ tone = 'neutral', className, ...props }: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium',
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
