import { UPGRADE_DISPLAY_ORDER } from './constants';
import { parseStoredUpgrades } from './lineItems';

export const EVENT_FORM_UPGRADE_MAP = {
  hasLighting: 'lighting',
  hasSoundSystem: 'amplification',
  hasScreens: 'screens',
  hasFireworks: 'fireworks',
} as const;

export type EventFormEquipmentFields = {
  hasLighting?: boolean;
  hasSoundSystem?: boolean;
  hasScreens?: boolean;
  hasFireworks?: boolean;
};

export const DEFAULT_UPGRADES: Record<string, boolean> = Object.fromEntries(
  UPGRADE_DISPLAY_ORDER.map((key) => [key, key === 'baseDesign']),
);

export function resolveEffectiveUpgrades(
  stored: unknown,
  eventForm?: EventFormEquipmentFields | null,
): Record<string, boolean> {
  const base = { ...DEFAULT_UPGRADES, ...parseStoredUpgrades(stored) };
  if (!eventForm) return base;

  for (const [formField, upgradeKey] of Object.entries(EVENT_FORM_UPGRADE_MAP)) {
    if (eventForm[formField as keyof EventFormEquipmentFields]) {
      base[upgradeKey] = true;
    }
  }
  return base;
}
