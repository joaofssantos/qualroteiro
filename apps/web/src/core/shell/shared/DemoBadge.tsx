import { cn } from '@/lib/utils';

import { isDemoMode } from '../../api/demo/mode';

export function DemoBadge({ className }: { className?: string }) {
  if (!isDemoMode()) return null;
  return (
    <div
      role="status"
      className={cn(
        'shrink-0 rounded-md bg-accent px-2 py-1 text-center text-[11px] font-bold uppercase tracking-wide text-accent-foreground',
        className,
      )}
    >
      modo demonstração
    </div>
  );
}
