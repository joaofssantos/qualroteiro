import { Settings } from 'lucide-react';
import { useState } from 'react';

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

import { LAYOUT_META, type LayoutId, isLayoutId } from './layoutConfig';
import { useLayoutStore } from './layoutStore';

const OPTIONS = (Object.keys(LAYOUT_META) as LayoutId[]).map((id) => ({
  value: id,
  label: LAYOUT_META[id].label,
}));

/** Ajustes: escolha do layout, aplicada na hora (sem recarregar). */
export function SettingsDialog({ triggerClassName }: { triggerClassName?: string }) {
  const [open, setOpen] = useState(false);
  const layout = useLayoutStore((s) => s.layout);
  const setLayout = useLayoutStore((s) => s.setLayout);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
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
        <Segmented
          aria-label="Layout"
          value={layout}
          onValueChange={(value) => {
            if (isLayoutId(value)) setLayout(value satisfies LayoutId);
          }}
          options={OPTIONS}
        />
        <p className="mt-3 text-sm text-muted-foreground">{LAYOUT_META[layout].description}</p>
      </DialogContent>
    </Dialog>
  );
}
