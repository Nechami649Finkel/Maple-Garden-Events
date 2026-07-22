export type PaidTo = 'hall' | 'external';

export interface ExtrasLineItem {
  label: string;
  price: number;
  paidTo?: PaidTo;
  key?: string;
}

export interface BuildLineItemsOptions {
  upgrades?: Record<string, boolean> | null;
  kosherType?: string | null;
  guestCount?: number;
  isHallOnly?: boolean;
  isFoodRelevant?: boolean;
  upgradesPricing?: Record<string, number>;
  upgradeKeys?: readonly string[];
}
