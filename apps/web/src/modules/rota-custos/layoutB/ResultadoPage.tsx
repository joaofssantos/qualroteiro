import { ArrowLeft } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import type { TollPlaza } from '@/core/api/types';
import { selectActiveRoute, useRouteStore } from '@/core/store/routeStore';
import { deriveAlternativeLabels } from '../blocks/deriveAlternativeLabels';
import {
  FUEL_STATION_LAYER_ID,
  MODULE_PATH,
  TOLL_LAYER_ID,
} from '../module';
import { FuelPanel } from '../panels/FuelPanel';
import { PointsPanel } from '../panels/PointsPanel';
import { SummaryRow } from '../panels/SummaryRow';
import { TollsPanel } from '../panels/TollsPanel';
import { SaveRouteToTripDialog } from '../SaveRouteToTripDialog';

import { CompareTable } from '@/core/shell/layouts/b/CompareTable';
import { MapCard } from '@/core/shell/layouts/b/MapCard';
import { MobileTotalBar } from './MobileTotalBar';
import { useIsMobile } from '@/core/shell/shared/useIsMobile';

/**
 * Resultado como página (layout B): KPIs no topo, mapa em cartão ao lado das
 * praças numeradas, e a tabela de alternativas. Lê tudo do `routeStore` — o
 * mapa já desenha a alternativa ativa porque `RotaCustosLayout` a publica.
 */
export function ResultadoPage({ onSelectPlaza }: { onSelectPlaza(plaza: TollPlaza | null): void }) {
  const query = useRouteStore((s) => s.query);
  const routes = useRouteStore((s) => s.routes);
  const activeIndex = useRouteStore((s) => s.activeIndex);
  const layers = useRouteStore((s) => s.layers);
  const setActiveIndex = useRouteStore((s) => s.setActiveIndex);
  const toggleLayer = useRouteStore((s) => s.toggleLayer);
  const reset = useRouteStore((s) => s.reset);
  const mobile = useIsMobile();

  const route = selectActiveRoute({ routes, activeIndex });
  if (!route || !query) return <Navigate to={MODULE_PATH} replace />;

  const title = `${query.originLabel} → ${query.destinationLabel}`;
  const axleCategory = query.vehicle.axleCategory;
  const labels = deriveAlternativeLabels(routes, axleCategory);
  const partial = (route.tolls.unavailablePlazaIds?.length ?? 0) > 0;

  return (
    <div
      aria-label="Custos da rota"
      role="region"
      className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5 md:px-8 md:py-8"
      style={mobile ? { paddingBottom: '6.5rem' } : undefined}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1 text-muted-foreground">
            <Link to={MODULE_PATH} onClick={reset}>
              <ArrowLeft /> Nova consulta
            </Link>
          </Button>
          <h1 className="text-xl font-bold tracking-tight text-primary md:text-2xl">Resultado da rota</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{title}</p>
        </div>
        {mobile ? null : <SaveRouteToTripDialog route={route} title={title} />}
      </header>

      <SummaryRow route={route} axleCategory={axleCategory} />

      <div className="grid gap-5 lg:grid-cols-2">
        <MapCard />
        <section aria-labelledby="b-pedagios" className="flex flex-col gap-2">
          <h2 id="b-pedagios" className="text-sm font-semibold">
            Pedágios
          </h2>
          <TollsPanel route={route} axleCategory={axleCategory} onSelectPlaza={onSelectPlaza} />
        </section>
      </div>

      <section aria-labelledby="b-alternativas" className="flex flex-col gap-2">
        <h2 id="b-alternativas" className="text-sm font-semibold">
          Alternativas
        </h2>
        <CompareTable
          routes={routes}
          labels={labels}
          selectedIndex={activeIndex}
          onSelect={setActiveIndex}
        />
      </section>

      <Accordion type="multiple" className="flex flex-col">
        <AccordionItem value="combustivel">
          <AccordionTrigger>Combustível</AccordionTrigger>
          <AccordionContent>
            <FuelPanel
              route={route}
              pricePerL={query.fuelPricePerL}
              consumptionKmPerL={query.vehicle.consumptionKmPerL}
            />
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="pontos">
          <AccordionTrigger>Pontos na rota</AccordionTrigger>
          <AccordionContent>
            <PointsPanel
              route={route}
              layers={layers}
              onToggleLayer={toggleLayer}
              tollLayerId={TOLL_LAYER_ID}
              fuelStationLayerId={FUEL_STATION_LAYER_ID}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {mobile ? <MobileTotalBar route={route} title={title} partial={partial} /> : null}
    </div>
  );
}
