import { Loader2, MapPin } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

import { searchPlaces } from '../api/client';
import type { Place } from '../api/types';

/**
 * A debounced place autocomplete.
 *
 * The value is `{ text, place }` rather than just a `Place`, because the API
 * accepts free text as well as coordinates. A user who types "Rio de Janeiro, RJ"
 * and submits without opening the dropdown still gets a route — the server
 * geocodes the string — and if it cannot, that is the `422` the form knows how to
 * attribute back to this field.
 */

export interface PlaceFieldValue {
  /** What is in the box. Submitted verbatim when `place` is null. */
  readonly text: string;
  /** The hit the user picked, if they picked one. */
  readonly place: Place | null;
}

export interface PlaceSearchProps {
  id: string;
  label: string;
  value: PlaceFieldValue;
  onChange: (value: PlaceFieldValue) => void;
  placeholder?: string;
  /** A field-level error, e.g. the message derived from a `422`. */
  error?: string | undefined;
  /** Milliseconds of silence before searching. */
  debounceMs?: number;
  /** Shortest query worth sending. */
  minChars?: number;
}

const DEFAULT_DEBOUNCE_MS = 300;
const DEFAULT_MIN_CHARS = 3;

export function PlaceSearch({
  id,
  label,
  value,
  onChange,
  placeholder,
  error,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  minChars = DEFAULT_MIN_CHARS,
}: PlaceSearchProps) {
  const [hits, setHits] = useState<readonly Place[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const listId = `${useId()}-listbox`;
  const errorId = `${id}-error`;

  /**
   * Set while the user is choosing, to stop the effect below from firing a fresh
   * search for the label it just wrote into the box.
   */
  const suppressRef = useRef(false);

  useEffect(() => {
    if (suppressRef.current) {
      suppressRef.current = false;
      return;
    }

    const query = value.text.trim();
    if (query.length < minChars) {
      setHits(null);
      setOpen(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      searchPlaces(query, controller.signal)
        .then((places) => {
          setHits(places);
          setOpen(true);
        })
        .catch((cause: unknown) => {
          // An abort means a newer keystroke superseded this request; showing an
          // error for it would flash a failure the user did not cause.
          if (cause instanceof DOMException && cause.name === 'AbortError') return;
          setHits([]);
          setOpen(true);
        })
        .finally(() => setLoading(false));
    }, debounceMs);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value.text, debounceMs, minChars]);

  function pick(place: Place): void {
    suppressRef.current = true;
    setOpen(false);
    setHits(null);
    onChange({ text: place.label, place });
  }

  return (
    <div className="relative flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          role="combobox"
          autoComplete="off"
          aria-expanded={open}
          aria-controls={listId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          placeholder={placeholder}
          value={value.text}
          onChange={(event) => onChange({ text: event.target.value, place: null })}
          onFocus={() => {
            if (hits && hits.length > 0) setOpen(true);
          }}
          // A blur that lands on an option must not close the list before the
          // click registers, hence the delay.
          onBlur={() => setTimeout(() => setOpen(false), 120)}
        />
        {loading ? (
          <Loader2
            aria-hidden
            className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
          />
        ) : null}
      </div>

      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}

      {open && hits ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={`Resultados para ${label}`}
          className={cn(
            'absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto',
            'rounded-md border border-border bg-popover p-1 shadow-lg animate-fade-in',
          )}
        >
          {hits.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              Nenhum lugar encontrado para “{value.text}”.
            </li>
          ) : (
            hits.map((place) => (
              <li key={place.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={value.place?.id === place.id}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pick(place)}
                  className={cn(
                    'flex w-full items-start gap-2 rounded px-2.5 py-2 text-left text-sm',
                    'hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none',
                  )}
                >
                  <MapPin aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block truncate">{place.label}</span>
                    {place.kind ? (
                      <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">
                        {place.kind}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
