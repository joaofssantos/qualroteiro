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
    throw new Error('people must be at least 1');
  }

  if (plan.pricePerPerson < 0) {
    throw new Error('pricePerPerson must be non-negative');
  }

  return {
    totalCost: plan.pricePerPerson * plan.people,
  };
}
