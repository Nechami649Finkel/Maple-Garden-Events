import {
  DEFAULT_UPGRADES_PRICING,
  EXTERNAL_UPGRADE_KEYS,
  KOSHER_PRICING,
  UPGRADE_DISPLAY_ORDER,
  UPGRADE_LABELS,
} from './constants';
import type { BuildLineItemsOptions, ExtrasLineItem } from './types';

function resolveUpgradeKeys(options: BuildLineItemsOptions): readonly string[] {
  return options.upgradeKeys ?? UPGRADE_DISPLAY_ORDER;
}

export function buildSelectedLineItems(options: BuildLineItemsOptions): ExtrasLineItem[] {
  const upgrades = options.upgrades ?? {};
  const kosherType = options.kosherType || 'machpud';
  const guestCount = Number(options.guestCount) || 0;
  const isHallOnly = !!options.isHallOnly;
  const isFoodRelevant = options.isFoodRelevant ?? !isHallOnly;
  const pricing = options.upgradesPricing ?? DEFAULT_UPGRADES_PRICING;
  const items: ExtrasLineItem[] = [];

  if (isFoodRelevant && guestCount > 0) {
    const kosher = KOSHER_PRICING[kosherType] ?? KOSHER_PRICING.machpud;
    if (kosher.extra > 0) {
      items.push({
        label: `כשרות (${kosher.label}) — ${guestCount} מנות`,
        price: guestCount * kosher.extra,
        paidTo: 'hall',
      });
    }
  }

  for (const key of resolveUpgradeKeys(options)) {
    if (!upgrades[key]) continue;
    if (isHallOnly && key === 'baseDesign') continue;
    items.push({
      key,
      label: UPGRADE_LABELS[key] ?? key,
      price: pricing[key] ?? 0,
      paidTo: EXTERNAL_UPGRADE_KEYS.has(key) ? 'external' : 'hall',
    });
  }

  return items;
}

/** @deprecated use buildSelectedLineItems */
export const buildExtrasLineItems = buildSelectedLineItems;

export function buildAvailableLineItems(options: BuildLineItemsOptions): ExtrasLineItem[] {
  const upgrades = options.upgrades ?? {};
  const isHallOnly = !!options.isHallOnly;
  const pricing = options.upgradesPricing ?? DEFAULT_UPGRADES_PRICING;

  return resolveUpgradeKeys(options)
    .filter((key) => !upgrades[key] && !(isHallOnly && key === 'baseDesign'))
    .map((key) => ({
      key,
      label: UPGRADE_LABELS[key] ?? key,
      price: pricing[key] ?? 0,
      paidTo: EXTERNAL_UPGRADE_KEYS.has(key) ? 'external' : 'hall',
    }));
}

export function parseStoredUpgrades(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const result: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'boolean') result[key] = value;
  }
  return result;
}
