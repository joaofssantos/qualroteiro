import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { MapSlot } from '@/core/layout/MapHost';
import { useMapStore } from '@/core/map/mapStore';
import { useIsMobile } from '@/core/shell/shared/useIsMobile';

import { MODULE_PATH } from '../module';
import { QueryForm } from '../QueryForm';

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

  const cardRef = useRef<HTMLDivElement>(null);

  // O cartão cobre a esquerda do mapa no desktop (largura medida, pois muda com a
  // janela); no mobile o mapa fica numa faixa própria, sem cobertura.
  useEffect(() => {
    const publish = () => {
      const right = mobile ? 0 : Math.round(cardRef.current?.getBoundingClientRect().right ?? 0);
      setMapPadding({ top: 0, right: 0, bottom: 0, left: right });
    };
    publish();
    window.addEventListener('resize', publish);
    return () => {
      window.removeEventListener('resize', publish);
      setMapPadding({ top: 0, right: 0, bottom: 0, left: 0 });
    };
  }, [mobile, setMapPadding]);

  return (
    <div className="relative flex min-h-[calc(100vh-3.5rem)] flex-col md:block">
      <MapSlot
        data-testid="hero-map-slot"
        className="h-[34vh] min-h-48 shrink-0 md:absolute md:inset-0 md:h-auto"
      />
      <div className="relative z-10 flex-1 md:pointer-events-none md:absolute md:inset-0 md:overflow-y-auto md:p-8">
        <div ref={cardRef} className="mx-auto w-full max-w-3xl px-4 py-6 md:pointer-events-auto md:mx-0 md:max-w-[min(56rem,calc(100vw-4rem))] md:rounded-xl md:border md:border-border md:bg-background/95 md:p-6 md:shadow-xl md:backdrop-blur">
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
