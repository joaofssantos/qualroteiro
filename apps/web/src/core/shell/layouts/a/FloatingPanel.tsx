import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface FloatingPanelProps {
  collapsed: boolean;
  onToggle(): void;
  children: ReactNode;
  /** Largura (px) do painel e do trilho, usadas para posicionar o botão de recolher. */
  panelWidth: number;
  railWidth: number;
  gap: number;
}

/**
 * Painel flutuante único sobre o mapa (desktop). Recolhido, o conteúdo continua
 * montado (o rascunho da consulta não se perde) mas fica oculto. No mobile vira
 * um bloco normal abaixo do mapa.
 */
export function FloatingPanel({
  collapsed,
  onToggle,
  children,
  panelWidth,
  railWidth,
  gap,
}: FloatingPanelProps) {
  const label = collapsed ? 'Expandir painel' : 'Recolher painel';
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <>
      <div
        data-testid="floating-panel"
        hidden={collapsed}
        className={cn(
          'floating-panel min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-card',
          'md:absolute md:bottom-4 md:left-[var(--panel-left)] md:top-4 md:z-10 md:w-[var(--panel-w)] md:flex-none md:rounded-xl md:border md:border-border md:shadow-lg',
        )}
        style={{ '--panel-left': `${railWidth + gap}px`, '--panel-w': `${panelWidth}px` } as React.CSSProperties}
      >
        {children}
      </div>
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-expanded={!collapsed}
        onClick={onToggle}
        className="absolute top-6 z-20 hidden size-11 items-center justify-center rounded-r-lg border border-l-0 border-border bg-card text-foreground shadow-md hover:bg-muted md:flex"
        style={{ left: collapsed ? railWidth : railWidth + gap + panelWidth }}
      >
        <Icon aria-hidden className="size-5" />
      </button>
    </>
  );
}
