import type { TariffByAxleCategory } from '@qualroteiro/tolls';

/**
 * Curated Free Flow points which ARTESP publishes in its tariff table but
 * which must not borrow the geometry of a similarly named OSM booth.
 *
 * The regulator's PDF is the tariff/vigency authority (01-07-2025). It only
 * publishes a km marker, not coordinates. Coordinates below were located on
 * the OSM road geometry at that official km marker; OSM data is ODbL 1.0.
 * Santo Antonio de Posse is additionally cross-checked against Maplink's
 * published Free Flow example. Keep this provenance here and in the audit.
 */
export interface ArtespFreeFlowRecord {
  readonly id: string; readonly name: string; readonly highway: string; readonly km: number;
  readonly lat: number; readonly lng: number; readonly concessionaire: string;
  readonly tariff: TariffByAxleCategory;
}

function tariff(car: number, motorcycle?: number): TariffByAxleCategory {
  const byAxles = (axles: number) => Math.round(car * axles * 100) / 100;
  return {
    ...(motorcycle === undefined ? {} : { motorcycle }),
    car, car_with_trailer: car, truck_2_axle: byAxles(2), truck_3_axle: byAxles(3),
    truck_4_axle: byAxles(4), truck_5_axle: byAxles(5), truck_6_axle: byAxles(6),
  };
}

export const ARTESP_FREE_FLOW_RECORDS: readonly ArtespFreeFlowRecord[] = [
  { id: 'artesp-free-flow-sp-340-santo-antonio-posse', name: 'Pórtico Santo Antônio de Posse', highway: 'SP-340', km: 147.03, lat: -22.56286671, lng: -47.00042384, concessionaire: 'Renovias', tariff: tariff(8.8) },
  { id: 'artesp-free-flow-sp-332-engenheiro-coelho', name: 'Pórtico Engº Coelho (PaP)', highway: 'SP-332', km: 159.7, lat: -22.5028, lng: -47.2047, concessionaire: 'Rota das Bandeiras', tariff: tariff(7.9, 3.95) },
  { id: 'artesp-free-flow-sp-332-paulinia-betel', name: 'Paulínia Jd. Betel (PaP)', highway: 'SP-332', km: 119.1, lat: -22.7554, lng: -47.1651, concessionaire: 'Rota das Bandeiras', tariff: tariff(5.5, 2.75) },
  { id: 'artesp-free-flow-sp-075-indaiatuba', name: 'Pórtico Bloqueio Indaiatuba (PaP)', highway: 'SP-075', km: 62, lat: -23.0321, lng: -47.1864, concessionaire: 'Via Colinas', tariff: tariff(3.5) },
  { id: 'artesp-free-flow-sp-075-itu-1', name: 'Pórtico Itu 1 (PaP)', highway: 'SP-075', km: 26.75, lat: -23.2634, lng: -47.2902, concessionaire: 'Via Colinas', tariff: tariff(4.3) },
  { id: 'artesp-free-flow-sp-360-jundiai', name: 'Pórtico Jundiaí (PaP)', highway: 'SP-360', km: 77.1, lat: -23.0386, lng: -46.9997, concessionaire: 'Rota das Bandeiras', tariff: tariff(2.3, 1.15) },
  // These intentionally share the physical charge point with the OSM rows;
  // matchTolls' 100m tariff-preferred de-duplication selects ARTESP once.
  { id: 'artesp-free-flow-sp-021-imigrantes-2', name: 'PRAÇA 2 - TRECHO SUL / IMIGRANTES (Pista Externa)', highway: 'SP-021', km: 0, lat: -23.7180391, lng: -46.6059124, concessionaire: 'Ecovias Imigrantes', tariff: tariff(5.4, 2.7) },
  { id: 'artesp-free-flow-sp-021-imigrantes-3', name: 'PRAÇA 3 - TRECHO SUL / IMIGRANTES (Pista Externa)', highway: 'SP-021', km: 0, lat: -23.7524559, lng: -46.5952764, concessionaire: 'Ecovias Imigrantes', tariff: tariff(5.4, 2.7) },
];
