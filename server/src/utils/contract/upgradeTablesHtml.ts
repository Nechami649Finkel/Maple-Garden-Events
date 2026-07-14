import {
  AVAILABLE_UPGRADES_INTRO,
  formatMoneyLine,
  paymentNoteText,
  type ExtrasLineItem,
} from '../../vendor/shared/contract';

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

function renderUpgradeTable(items: ExtrasLineItem[], emptyMessage: string): string {
  const rows = renderUpgradeTableRows(items, emptyMessage);
  const total = items.reduce((sum, item) => sum + item.price, 0);
  const totalRow =
    items.length > 0
      ? `<tr class="total-row">
          <td><strong>סה&quot;כ</strong></td>
          <td class="price-cell"><strong>${esc(formatMoneyLine(total))}</strong></td>
          <td></td>
        </tr>`
      : '';

  return `<table class="data-table upgrades-table">
    <thead>
      <tr>
        <th>שירות</th>
        <th>מחיר</th>
        <th>הערת תשלום</th>
      </tr>
    </thead>
    <tbody>${rows}${totalRow}</tbody>
  </table>`;
}

export function renderSelectedUpgradesTable(items: ExtrasLineItem[]): string {
  return renderUpgradeTable(
    items,
    'לא נבחרו תוספות או שדרוגים בנוסף לתנאי הבסיס בחוזה.',
  );
}

export function renderAvailableUpgradesTable(items: ExtrasLineItem[]): string {
  return renderUpgradeTable(items, 'כל שירותי השדרוג הזמינים נכללו בהזמנה.');
}

export function renderUpgradesSectionsHtml(options: {
  selectedExtras: ExtrasLineItem[];
  availableExtras: ExtrasLineItem[];
}): string {
  return `
  <div class="section upgrades-section">
    <div class="section-title">תוספות ושדרוגים שנבחרו</div>
    ${renderSelectedUpgradesTable(options.selectedExtras)}
  </div>
  <div class="section upgrades-section">
    <div class="section-title">אפשרויות לשדרוג נוסף</div>
    <p class="marketing-intro">${esc(AVAILABLE_UPGRADES_INTRO)}</p>
    ${renderAvailableUpgradesTable(options.availableExtras)}
  </div>`;
}
