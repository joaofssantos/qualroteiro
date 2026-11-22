import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { MapSlot } from '@/core/layout/MapHost';
import { useMapStore } from '@/core/map/mapStore';
import { MODULE_PATH } from '@/modules/rota-custos/module';
import { QueryForm } from '@/modules/rota-custos/QueryForm';

import { useIsMobile } from './useIsMobile';

/** Largura reservada ao cartão da consulta (px) sobre o mapa, no desktop. */
const HERO_CARD_PX = 600;

/**
 * Consulta como *hero* sobre o mapa (layout B). O mapa é o mesmo nó do
 * `AppShell`, posicionado por `MapSlot` atrás do cartão; ao escolher origem e
 * destino com coordenadas, `QueryForm` publica pinos, pede enquadramento e
 * liga a prévia — o mapa já mostra o trajeto antes do "Calcular".
 */
export function ConsultaHero() {
  const navigate = useNavigate();
  const mobile = useIsMobile();
  const setMapPadding = useMapStore((s) => s.setMapPadding);

  // O cartão cobre a esquerda do mapa no desktop; no mobile o mapa fica numa faixa própria.
  useEffect(() => {
    setMapPadding({ top: 0, right: 0, bottom: 0, left: mobile ? 0 : HERO_CARD_PX });
    return () => setMapPadding({ top: 0, right: 0, bottom: 0, left: 0 });
  }, [mobile, setMapPadding]);

  return (
    <div className="relative flex min-h-[calc(100vh-3.5rem)] flex-col md:block">
      <MapSlot
        data-testid="hero-map-slot"
        className="h-[34vh] min-h-48 shrink-0 md:absolute md:inset-0 md:h-auto"
      />
      <div className="relative z-10 flex-1 md:pointer-events-none md:absolute md:inset-0 md:overflow-y-auto md:p-8">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 md:pointer-events-auto md:mx-0 md:max-w-[37.5rem] md:rounded-xl md:border md:border-border md:bg-background/95 md:p-6 md:shadow-xl md:backdrop-blur">
          <header className="mb-5">
            <h1 className="text-2xl font-bold tracking-tight text-primary md:text-3xl">
              Quanto custa essa viagem?
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Escolha origem e destino: o trajeto aparece no mapa na hora. O custo vem ao calcular.
            </p>
          </header>
          <QueryForm variant="hero" onSubmitted={() => navigate(`${MODULE_PATH}/resultado`)} />
        </div>
      </div>
    </div>
  );
}
