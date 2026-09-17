export interface RestaurantVisit {
  readonly placeName: string;
  readonly address: string | null;
  readonly lat: number | null;
  readonly lng: number | null;
  readonly date: string | null;
  readonly pricePerPerson: number;
  readonly people: number;
}

export interface RestaurantCost {
  readonly totalCost: number;
}

export function calculateRestaurantCost(visit: RestaurantVisit): RestaurantCost {
  if (visit.people < 1) throw new Error('Informe pelo menos uma pessoa.');
  if (visit.pricePerPerson < 0) throw new Error('O preço por pessoa não pode ser negativo.');

  return {
    totalCost: visit.pricePerPerson * visit.people,
  };
}
