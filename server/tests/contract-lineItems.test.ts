import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAvailableLineItems,
  buildSelectedLineItems,
  parseStoredUpgrades,
} from '../../shared/contract/lineItems';
import {
  DEFAULT_UPGRADES,
  resolveEffectiveUpgrades,
} from '../../shared/contract/resolveUpgrades';
import {
  buildContractAnnex,
  stripAnnexUpgradeSections,
} from '../../shared/contract/annexText';

const baseOptions = {
  upgrades: {
    baseDesign: true,
    amplification: false,
    lighting: false,
    screens: false,
    reception: true,
    separateReception: false,
    extraSecurity: false,
    fireworks: false,
  },
  kosherType: 'machpud',
  guestCount: 100,
  isHallOnly: false,
  isFoodRelevant: true,
  upgradesPricing: {
    baseDesign: 4500,
    amplification: 1400,
    lighting: 1800,
    screens: 800,
    reception: 2000,
    separateReception: 3000,
    extraSecurity: 650,
    fireworks: 700,
  },
};

describe('buildAvailableLineItems', () => {
  it('returns unselected upgrade keys with prices', () => {
    const available = buildAvailableLineItems(baseOptions);
    const keys = available.map((item) => item.key);
    assert.ok(keys.includes('lighting'));
    assert.ok(keys.includes('amplification'));
    assert.ok(!keys.includes('reception'));
    assert.ok(!keys.includes('baseDesign'));
  });

  it('hides baseDesign for hall-only bookings', () => {
    const available = buildAvailableLineItems({
      ...baseOptions,
      isHallOnly: true,
      isFoodRelevant: false,
      upgrades: { ...baseOptions.upgrades, baseDesign: false },
    });
    assert.ok(!available.some((item) => item.key === 'baseDesign'));
  });
});

describe('buildSelectedLineItems', () => {
  it('includes kosher surcharge when relevant', () => {
    const selected = buildSelectedLineItems({
      ...baseOptions,
      kosherType: 'rubin',
      guestCount: 50,
    });
    assert.ok(selected.some((item) => item.label.includes('כשרות')));
  });
});

describe('parseStoredUpgrades', () => {
  it('parses boolean map from JSON', () => {
    assert.deepEqual(parseStoredUpgrades({ lighting: true, screens: false }), {
      lighting: true,
      screens: false,
    });
  });

  it('returns empty object for invalid input', () => {
    assert.deepEqual(parseStoredUpgrades(null), {});
    assert.deepEqual(parseStoredUpgrades([]), {});
  });
});

describe('resolveEffectiveUpgrades', () => {
  it('applies DEFAULT_UPGRADES when stored upgrades are empty', () => {
    const resolved = resolveEffectiveUpgrades(null);
    assert.equal(resolved.baseDesign, true);
    assert.equal(resolved.lighting, false);
  });

  it('merges eventForm equipment flags into upgrades', () => {
    const resolved = resolveEffectiveUpgrades({}, {
      hasLighting: true,
      hasSoundSystem: true,
    });
    assert.equal(resolved.lighting, true);
    assert.equal(resolved.amplification, true);
    assert.equal(resolved.baseDesign, true);
  });

  it('stored upgrades override defaults', () => {
    const resolved = resolveEffectiveUpgrades({ baseDesign: false, reception: true });
    assert.equal(resolved.baseDesign, false);
    assert.equal(resolved.reception, true);
  });

  it('excludes eventForm-selected upgrades from available line items', () => {
    const upgrades = resolveEffectiveUpgrades({}, {
      hasLighting: true,
      hasSoundSystem: true,
    });
    const available = buildAvailableLineItems({
      ...baseOptions,
      upgrades,
    });
    const keys = available.map((item) => item.key);
    assert.ok(!keys.includes('lighting'));
    assert.ok(!keys.includes('amplification'));
    assert.ok(!keys.includes('baseDesign'));
  });
});

describe('stripAnnexUpgradeSections', () => {
  it('removes selected and available upgrade sections from annex text', () => {
    const annex = buildContractAnnex({
      paymentTerms: 'תשלום במזומן',
      selectedExtras: [{ label: 'תאורה', price: 1800, paidTo: 'external', key: 'lighting' }],
      availableExtras: [{ label: 'מסכים', price: 800, paidTo: 'external', key: 'screens' }],
      menuNotes: ['הערה'],
    });

    const stripped = stripAnnexUpgradeSections(annex);
    assert.ok(!stripped.includes('▌ תוספות ושדרוגים שנבחרו'));
    assert.ok(!stripped.includes('▌ אפשרויות לשדרוג נוסף'));
    assert.ok(stripped.includes('▌ תנאי תשלום'));
    assert.ok(stripped.includes('▌ הערות והנחיות מיוחדות לתפריט'));
    assert.ok(stripped.includes('הערה'));
  });
});

describe('DEFAULT_UPGRADES', () => {
  it('has baseDesign enabled by default', () => {
    assert.equal(DEFAULT_UPGRADES.baseDesign, true);
  });
});
