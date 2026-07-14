"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AVAILABLE_UPGRADES_INTRO = exports.ANNEX_TITLE = exports.SECTION_DIVIDER = exports.CONTRACT_ANNEX_PLACEHOLDER = exports.KOSHER_PRICING = exports.DEFAULT_UPGRADES_PRICING = exports.EXTERNAL_UPGRADE_KEYS = exports.UPGRADE_DISPLAY_ORDER = exports.UPGRADE_LABELS = void 0;
exports.UPGRADE_LABELS = {
    baseDesign: 'עיצוב בסיסי',
    reception: 'קבלת פנים',
    separateReception: 'קבלת פנים נפרד',
    lighting: 'תאורה',
    amplification: 'הגברה',
    screens: 'מסכים',
    fireworks: 'זיקוקים',
    extraSecurity: 'מאבטח נוסף',
};
exports.UPGRADE_DISPLAY_ORDER = [
    'baseDesign',
    'reception',
    'separateReception',
    'lighting',
    'amplification',
    'screens',
    'fireworks',
    'extraSecurity',
];
exports.EXTERNAL_UPGRADE_KEYS = new Set([
    'baseDesign',
    'lighting',
    'amplification',
    'screens',
    'fireworks',
]);
exports.DEFAULT_UPGRADES_PRICING = {
    baseDesign: 4500,
    amplification: 1400,
    lighting: 1800,
    screens: 800,
    reception: 2000,
    separateReception: 3000,
    extraSecurity: 650,
    fireworks: 700,
};
exports.KOSHER_PRICING = {
    machpud: { label: 'הרב מחפוד', extra: 0 },
    rubin: { label: 'הרב רובין', extra: 10 },
    kehilot: { label: 'קהילות', extra: 10 },
    gross: { label: 'הרב גרוס', extra: 10 },
    landa: { label: 'הרב לנדא', extra: 20 },
    badatz: { label: 'בד"ץ העדה החרדית', extra: 20 },
};
exports.CONTRACT_ANNEX_PLACEHOLDER = '{{CONTRACT_ANNEX}}';
exports.SECTION_DIVIDER = '────────────────────────────────';
exports.ANNEX_TITLE = 'נספח ההזמנה — פירוט לאירוע זה';
exports.AVAILABLE_UPGRADES_INTRO = 'להלן שירותים נוספים הניתנים לשדרוג האירוע. בחירה בהם תחייב את המזמין/ה בתוספת התשלום המפורט, בכפוף לזמינות ולאישור הנהלת גן מייפל אירועים.';
