"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_UPGRADES = exports.EVENT_FORM_UPGRADE_MAP = void 0;
exports.resolveEffectiveUpgrades = resolveEffectiveUpgrades;
const constants_1 = require("./constants");
const lineItems_1 = require("./lineItems");
exports.EVENT_FORM_UPGRADE_MAP = {
    hasLighting: 'lighting',
    hasSoundSystem: 'amplification',
    hasScreens: 'screens',
    hasFireworks: 'fireworks',
};
exports.DEFAULT_UPGRADES = Object.fromEntries(constants_1.UPGRADE_DISPLAY_ORDER.map((key) => [key, key === 'baseDesign']));
function resolveEffectiveUpgrades(stored, eventForm) {
    const base = { ...exports.DEFAULT_UPGRADES, ...(0, lineItems_1.parseStoredUpgrades)(stored) };
    if (!eventForm)
        return base;
    for (const [formField, upgradeKey] of Object.entries(exports.EVENT_FORM_UPGRADE_MAP)) {
        if (eventForm[formField]) {
            base[upgradeKey] = true;
        }
    }
    return base;
}
