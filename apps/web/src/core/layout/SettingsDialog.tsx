import { Settings } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Segmented } from '@/components/ui/segmented';

import { LAYOUT_META, type LayoutId, isLayoutId, registeredLayoutIds, resolveLayoutId } from './layoutConfig';
import { useLayoutStore } from './layoutStore';

const OPTIONS = registeredLayoutIds().map((id) => ({
  value: id,
  label: LAYOUT_META[id].label,
}));

/**
 * Trocar o layout desmonta o shell (e com ele o gatilho de Ajustes que tinha o foco);
 * sem isto o foco cairia no `body`. A instância montada pelo novo shell reivindica o
 * foco se a troca foi feita há pouco. Instâncias ocultas (CSS) não conseguem focar e
 * deixam o pedido para a próxima.
 */
const FOCUS_HANDOFF_MS = 5_000;
let focusHandoffAt: number | null = null;

/** Ajustes: escolha do layout, aplicada na hora (sem recarregar). */
export function SettingsDialog({ triggerClassName }: { triggerClassName?: string }) {
  const [open, setOpen] = useState(false);
  const layout = useLayoutStore((s) => s.layout);
  const setLayout = useLayoutStore((s) => s.setLayout);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (focusHandoffAt === null) return;
    if (Date.now() - focusHandoffAt > FOCUS_HANDOFF_MS) {
      focusHandoffAt = null;
      return;
    }
    const trigger = triggerRef.current;
    trigger?.focus();
    if (trigger && document.activeElement === trigger) focusHandoffAt = null;
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          variant="ghost"
          size="icon"
          className={triggerClassName}
          aria-label="Ajustes"
          title="Ajustes"
        >
          <Settings aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajustes</DialogTitle>
          <DialogDescription>Escolha como o app organiza o mapa e os custos.</DialogDescription>
        </DialogHeader>
        {OPTIONS.length > 1 && (
          <>
            <Segmented
              aria-label="Layout"
              value={resolveLayoutId(layout)}
              onValueChange={(value) => {
                if (isLayoutId(value)) {
                  // O diálogo pertence ao shell atual. Fechá-lo antes de trocar o
                  // layout evita manter um portal/foco órfão enquanto o shell é
                  // desmontado e o novo é carregado.
                  setOpen(false);
                  focusHandoffAt = Date.now();
                  setLayout(value satisfies LayoutId);
                }
              }}
              options={OPTIONS}
            />
            <p className="mt-3 text-sm text-muted-foreground">
              {LAYOUT_META[resolveLayoutId(layout)].description}
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
