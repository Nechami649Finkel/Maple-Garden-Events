"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatMoneyLine = formatMoneyLine;
exports.paymentNoteText = paymentNoteText;
exports.renderSelectedExtrasSection = renderSelectedExtrasSection;
exports.renderAvailableExtrasSection = renderAvailableExtrasSection;
exports.renderMenuNotesSection = renderMenuNotesSection;
exports.buildContractAnnex = buildContractAnnex;
exports.stripAnnexUpgradeSections = stripAnnexUpgradeSections;
exports.mergeContractAnnexIntoBase = mergeContractAnnexIntoBase;
const constants_1 = require("./constants");
function formatMoneyLine(amount) {
    return `₪${Math.round(amount).toLocaleString('he-IL')}`;
}
function paymentNoteText(paidTo) {
    return paidTo === 'external' ? 'תשלום ישיר לספק חיצוני' : 'דרך גן מייפל אירועים';
}
function renderSelectedExtrasSection(items) {
    if (items.length === 0) {
        return 'לא נבחרו תוספות או שדרוגים בנוסף לתנאי הבסיס בחוזה.';
    }
    const lines = items.map((item) => {
        const payNote = item.paidTo === 'external' ? ' (תשלום ישיר לספק חיצוני)' : '';
        return `• ${item.label} — ${formatMoneyLine(item.price)}${payNote}`;
    });
    const total = items.reduce((sum, item) => sum + item.price, 0);
    lines.push('────────────────');
    lines.push(`סה"כ תוספות: ${formatMoneyLine(total)}`);
    return lines.join('\n');
}
function renderAvailableExtrasSection(items) {
    if (items.length === 0) {
        return 'כל שירותי השדרוג הזמינים נכללו בהזמנה.';
    }
    return items
        .map((item) => {
        const payNote = item.paidTo === 'external' ? ' (תשלום ישיר לספק חיצוני)' : '';
        return `• ${item.label} — ${formatMoneyLine(item.price)}${payNote}`;
    })
        .join('\n');
}
function renderMenuNotesSection(notes) {
    const filtered = notes.map((n) => n.trim()).filter(Boolean);
    if (filtered.length === 0) {
        return 'לא נרשמו הערות מיוחדות לתפריט.';
    }
    return filtered.map((note) => `• ${note}`).join('\n');
}
function buildContractAnnex(options) {
    return [
        constants_1.SECTION_DIVIDER,
        constants_1.ANNEX_TITLE,
        constants_1.SECTION_DIVIDER,
        '',
        '▌ תנאי תשלום',
        options.paymentTerms.trim() || 'לא הוגדרו תנאי תשלום.',
        '',
        '▌ תוספות ושדרוגים שנבחרו',
        renderSelectedExtrasSection(options.selectedExtras),
        '',
        '▌ אפשרויות לשדרוג נוסף',
        constants_1.AVAILABLE_UPGRADES_INTRO,
        renderAvailableExtrasSection(options.availableExtras),
        '',
        '▌ הערות והנחיות מיוחדות לתפריט',
        renderMenuNotesSection(options.menuNotes),
        constants_1.SECTION_DIVIDER,
    ].join('\n');
}
const ANNEX_UPGRADE_SECTION_HEADERS = [
    '▌ תוספות ושדרוגים שנבחרו',
    '▌ אפשרויות לשדרוג נוסף',
];
/** Removes upgrade table sections from contract annex text (PDF renders them as HTML tables). */
function stripAnnexUpgradeSections(contractText) {
    let text = contractText;
    for (const header of ANNEX_UPGRADE_SECTION_HEADERS) {
        const start = text.indexOf(header);
        if (start === -1)
            continue;
        const afterHeader = start + header.length;
        const nextSection = text.indexOf('\n▌ ', afterHeader);
        const end = nextSection === -1 ? text.length : nextSection;
        let removeStart = start;
        if (removeStart > 0 && text[removeStart - 1] === '\n') {
            removeStart -= 1;
        }
        text = text.slice(0, removeStart) + text.slice(end);
    }
    return text.replace(/\n{3,}/g, '\n\n').trim();
}
function mergeContractAnnexIntoBase(baseContract, annex) {
    if (baseContract.includes('{{CONTRACT_ANNEX}}')) {
        return baseContract.replace('{{CONTRACT_ANNEX}}', annex);
    }
    const marker = 'הנהלת מייפל אירועים מאחלת';
    if (baseContract.includes(marker)) {
        return baseContract.replace(marker, `${annex}\n\n${marker}`);
    }
    return `${baseContract.trim()}\n\n${annex}`;
}
