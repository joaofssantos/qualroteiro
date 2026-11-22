import { Menu } from 'lucide-react';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

import { AuthSlot } from '../../shared/AuthSlot';
import type { ModuleNavItem } from '../../shared/moduleNav';

/**
 * Menu do B no mobile: um botão "Menu" abre um diálogo com os módulos. Os links
 * só existem no DOM com o menu aberto (nomes acessíveis únicos); Esc fecha e o
 * foco volta ao botão (comportamento do Radix).
 */
export function MobileMenu({ items }: { items: readonly ModuleNavItem[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Menu"
          aria-expanded={open}
          className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
        >
          <Menu aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Menu</DialogTitle>
          <DialogDescription>Escolha um módulo.</DialogDescription>
        </DialogHeader>
        <nav aria-label="Módulos" className="flex flex-col gap-1">
          {items.map(({ id, label, path, Icon }) => (
            <NavLink
              key={id}
              to={path}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex min-h-[44px] items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors',
                  isActive ? 'bg-secondary text-primary' : 'text-foreground hover:bg-secondary/60',
                )
              }
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-3 border-t border-border pt-3">
          <AuthSlot />
        </div>
      </DialogContent>
    </Dialog>
  );
}
