import {
  AVAILABLE_UPGRADES_INTRO,
  formatMoneyLine,
  paymentNoteText,
  type ExtrasLineItem,
} from '../../vendor/shared/contract';
import { DEFAULT_LOCALE, getServerTranslation, T, type Locale } from '../../i18n/getServerTranslation';

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderUpgradeTableRows(items: ExtrasLineItem[], emptyMessage: string): string {
  if (items.length === 0) {
    return `<tr><td colspan="3" class="empty-cell">${esc(emptyMessage)}</td></tr>`;
  }

  return items
    .map(
      (item) => `<tr>
        <td>${esc(item.label)}</td>
        <td class="price-cell">${esc(formatMoneyLine(item.price))}</td>
        <td>${esc(paymentNoteText(item.paidTo))}</td>
      </tr>`,
    )
    .join('');
}

function renderUpgradeTable(
  items: ExtrasLineItem[],
  emptyMessage: string,
  locale: Locale,
): string {
  const { t } = getServerTranslation(locale);
  const rows = renderUpgradeTableRows(items, emptyMessage);
  const total = items.reduce((sum, item) => sum + item.price, 0);
  const totalRow =
    items.length > 0
      ? `<tr class="total-row">
          <td><strong>${esc(t(T.SERVER.PDF.UPGRADES.TOTAL))}</strong></td>
          <td class="price-cell"><strong>${esc(formatMoneyLine(total))}</strong></td>
          <td></td>
        </tr>`
      : '';

  return `<table class="data-table upgrades-table">
    <thead>
      <tr>
        <th>${esc(t(T.SERVER.PDF.UPGRADES.SERVICE))}</th>
        <th>${esc(t(T.SERVER.PDF.UPGRADES.PRICE))}</th>
        <th>${esc(t(T.SERVER.PDF.UPGRADES.PAYMENT_NOTE))}</th>
      </tr>
    </thead>
    <tbody>${rows}${totalRow}</tbody>
  </table>`;
}

export function renderSelectedUpgradesTable(items: ExtrasLineItem[], locale: Locale = DEFAULT_LOCALE): string {
  const { t } = getServerTranslation(locale);
  return renderUpgradeTable(items, t(T.SERVER.PDF.UPGRADES.NONE_SELECTED), locale);
}

export function renderAvailableUpgradesTable(items: ExtrasLineItem[], locale: Locale = DEFAULT_LOCALE): string {
  const { t } = getServerTranslation(locale);
  return renderUpgradeTable(items, t(T.SERVER.PDF.UPGRADES.ALL_INCLUDED), locale);
}

export function renderUpgradesSectionsHtml(
  options: {
    selectedExtras: ExtrasLineItem[];
    availableExtras: ExtrasLineItem[];
  },
  locale: Locale = DEFAULT_LOCALE,
): string {
  const { t } = getServerTranslation(locale);
  return `
  <div class="section upgrades-section">
    <div class="section-title">${esc(t(T.SERVER.PDF.UPGRADES.SELECTED_TITLE))}</div>
    ${renderSelectedUpgradesTable(options.selectedExtras, locale)}
  </div>
  <div class="section upgrades-section">
    <div class="section-title">${esc(t(T.SERVER.PDF.UPGRADES.AVAILABLE_TITLE))}</div>
    <p class="marketing-intro">${esc(AVAILABLE_UPGRADES_INTRO)}</p>
    ${renderAvailableUpgradesTable(options.availableExtras, locale)}
  </div>`;
}
