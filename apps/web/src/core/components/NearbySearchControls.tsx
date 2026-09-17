import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import type { PlaceCategory } from '@/core/api/types';
import { PLACE_TYPE_OPTIONS, RADIUS_OPTIONS } from '@/core/api/placeTypes';

export interface NearbySearchControlsProps {
  /** Unique per module, used to build stable element ids (e.g. `lodging`). */
  readonly idPrefix: string;
  readonly category: PlaceCategory;
  readonly radiusMeters: number;
  readonly onRadiusChange: (meters: number) => void;
  /** Curated Places types selected within `category`; empty means "Todos" (today's default). */
  readonly selectedTypes: readonly string[];
  readonly onToggleType: (value: string) => void;
}

/**
 * Radius select + type chips shared by the three nearby-search modules
 * (Hospedagem/Restaurantes/Atividades).
 *
 * A native `<select>` rather than a slider (decision 5 of `orientation.md` for
 * j-20260917-qv): the reference marks (1/3/5/10/20 km) are a short, familiar
 * set of choices — same reasoning as the vehicle profile `Select` — and it
 * needs no pointer-drag affordance or extra a11y wiring a slider would.
 *
 * Type chips are multi-select and additive (decision 1/2): none pressed keeps
 * the category's single base type; toggling one or more replaces it with the
 * selection, never adds to it.
 */
export function NearbySearchControls({
  idPrefix,
  category,
  radiusMeters,
  onRadiusChange,
  selectedTypes,
  onToggleType,
}: NearbySearchControlsProps) {
  const options = PLACE_TYPE_OPTIONS[category];
  const radiusId = `${idPrefix}-radius`;
  const typesLabelId = `${idPrefix}-types-label`;

  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5 sm:max-w-[12rem]">
        <Label htmlFor={radiusId}>Raio de busca</Label>
        <Select
          id={radiusId}
          value={String(radiusMeters)}
          onChange={(event) => onRadiusChange(Number(event.target.value))}
        >
          {RADIUS_OPTIONS.map((option) => (
            <option key={option.meters} value={option.meters}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid gap-1.5">
        <span id={typesLabelId} className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Tipo de lugar
        </span>
        <div role="group" aria-labelledby={typesLabelId} className="flex flex-wrap gap-2">
          {options.map((option) => {
            const selected = selectedTypes.includes(option.value);
            return (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={selected ? 'secondary' : 'outline'}
                aria-pressed={selected}
                onClick={() => onToggleType(option.value)}
              >
                {option.label}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
