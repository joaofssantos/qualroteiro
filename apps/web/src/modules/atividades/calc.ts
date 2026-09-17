export interface ActivityPlan {
  readonly placeName: string;
  readonly address: string | null;
  readonly date: string | null;
  readonly pricePerPerson: number;
  readonly people: number;
}

export interface ActivityCost {
  readonly totalCost: number;
}

export function calculateActivityCost(plan: ActivityPlan): ActivityCost {
  if (plan.people < 1) {
    throw new Error('Informe pelo menos uma pessoa.');
  }

  if (plan.pricePerPerson < 0) {
    throw new Error('O preço por pessoa não pode ser negativo.');
  }

  return {
    totalCost: plan.pricePerPerson * plan.people,
  };
}
