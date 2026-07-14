"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildExtrasLineItems = void 0;
exports.buildSelectedLineItems = buildSelectedLineItems;
exports.buildAvailableLineItems = buildAvailableLineItems;
exports.parseStoredUpgrades = parseStoredUpgrades;
const constants_1 = require("./constants");
function resolveUpgradeKeys(options) {
    return options.upgradeKeys ?? constants_1.UPGRADE_DISPLAY_ORDER;
}
function buildSelectedLineItems(options) {
    const upgrades = options.upgrades ?? {};
    const kosherType = options.kosherType || 'machpud';
    const guestCount = Number(options.guestCount) || 0;
    const isHallOnly = !!options.isHallOnly;
    const isFoodRelevant = options.isFoodRelevant ?? !isHallOnly;
    const pricing = options.upgradesPricing ?? constants_1.DEFAULT_UPGRADES_PRICING;
    const items = [];
    if (isFoodRelevant && guestCount > 0) {
        const kosher = constants_1.KOSHER_PRICING[kosherType] ?? constants_1.KOSHER_PRICING.machpud;
        if (kosher.extra > 0) {
            items.push({
                label: `כשרות (${kosher.label}) — ${guestCount} מנות`,
                price: guestCount * kosher.extra,
                paidTo: 'hall',
            });
        }
    }
    for (const key of resolveUpgradeKeys(options)) {
        if (!upgrades[key])
            continue;
        if (isHallOnly && key === 'baseDesign')
            continue;
        items.push({
            key,
            label: constants_1.UPGRADE_LABELS[key] ?? key,
            price: pricing[key] ?? 0,
            paidTo: constants_1.EXTERNAL_UPGRADE_KEYS.has(key) ? 'external' : 'hall',
        });
    }
    return items;
}
/** @deprecated use buildSelectedLineItems */
exports.buildExtrasLineItems = buildSelectedLineItems;
function buildAvailableLineItems(options) {
    const upgrades = options.upgrades ?? {};
    const isHallOnly = !!options.isHallOnly;
    const pricing = options.upgradesPricing ?? constants_1.DEFAULT_UPGRADES_PRICING;
    return resolveUpgradeKeys(options)
        .filter((key) => !upgrades[key] && !(isHallOnly && key === 'baseDesign'))
        .map((key) => ({
        key,
        label: constants_1.UPGRADE_LABELS[key] ?? key,
        price: pricing[key] ?? 0,
        paidTo: constants_1.EXTERNAL_UPGRADE_KEYS.has(key) ? 'external' : 'hall',
    }));
}
function parseStoredUpgrades(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        return {};
    const result = {};
    for (const [key, value] of Object.entries(raw)) {
        if (typeof value === 'boolean')
            result[key] = value;
    }
    return result;
}
