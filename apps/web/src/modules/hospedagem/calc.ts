export interface LodgingStay {
  readonly placeName: string;
  readonly address: string | null;
  readonly lat: number | null;
  readonly lng: number | null;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly pricePerNight: number;
}

export interface LodgingCost {
  readonly nights: number;
  readonly totalCost: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function calculateLodgingCost(stay: LodgingStay): LodgingCost {
  if (stay.pricePerNight < 0) {
    throw new Error('O preço por noite não pode ser negativo.');
  }

  const checkIn = parseIsoDate(stay.checkIn, 'checkIn');
  const checkOut = parseIsoDate(stay.checkOut, 'checkOut');
  const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / MS_PER_DAY);

  if (nights < 1) {
    throw new Error('checkOut must be after checkIn');
  }

  return {
    nights,
    totalCost: nights * stay.pricePerNight,
  };
}

function parseIsoDate(value: string, field: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${field} must be an ISO date`);
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new Error(`${field} must be an ISO date`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`${field} must be a valid ISO date`);
  }

  return date;
}
