import { mergePaymentTermsIntoContract } from './paymentTerms';
import {
  buildAvailableLineItems,
  buildSelectedLineItems,
  buildContractAnnex,
  mergeContractAnnexIntoBase,
  CONTRACT_ANNEX_PLACEHOLDER,
  SECTION_DIVIDER,
  ANNEX_TITLE,
  renderSelectedExtrasSection,
  renderAvailableExtrasSection,
  renderMenuNotesSection,
  parseStoredUpgrades,
  formatMoneyLine,
  paymentNoteText,
  type ExtrasLineItem,
} from '@shared/contract';

export {
  CONTRACT_ANNEX_PLACEHOLDER,
  SECTION_DIVIDER,
  ANNEX_TITLE,
  buildSelectedLineItems,
  buildAvailableLineItems,
  buildContractAnnex,
  mergeContractAnnexIntoBase,
  renderSelectedExtrasSection,
  renderAvailableExtrasSection,
  renderMenuNotesSection,
  parseStoredUpgrades,
  formatMoneyLine,
  paymentNoteText,
  type ExtrasLineItem,
};

/** @deprecated use buildSelectedLineItems */
export { buildSelectedLineItems as buildExtrasLineItems } from '@shared/contract';

export function resolveFullContractText(options: {
  baseContract: string;
  paymentTerms: string;
  extras?: ExtrasLineItem[];
  availableExtras?: ExtrasLineItem[];
  menuNotes?: string[];
  lineItemOptions?: Parameters<typeof buildSelectedLineItems>[0];
}): string {
  const lineItemOptions = options.lineItemOptions ?? {};
  const selectedExtras = options.extras ?? buildSelectedLineItems(lineItemOptions);
  const availableExtras = options.availableExtras ?? buildAvailableLineItems(lineItemOptions);

  const annex = buildContractAnnex({
    paymentTerms: options.paymentTerms,
    selectedExtras,
    availableExtras,
    menuNotes: options.menuNotes ?? [],
  });
  const withAnnex = mergeContractAnnexIntoBase(options.baseContract, annex);
  return mergePaymentTermsIntoContract(withAnnex, options.paymentTerms);
}

export function splitContractForDisplay(text: string): { mainText: string; annexText: string | null } {
  const idx = text.indexOf(ANNEX_TITLE);
  if (idx === -1) {
    return { mainText: text, annexText: null };
  }
  return {
    mainText: text.slice(0, idx).trimEnd(),
    annexText: text.slice(idx).trim(),
  };
}

export function parseAnnexSections(annexText: string): { title: string; body: string }[] {
  return annexText
    .split(/\n▌ /)
    .slice(1)
    .map((chunk) => {
      const lines = chunk.split('\n');
      const title = lines[0]?.trim() ?? '';
      const body = lines.slice(1).join('\n').replace(new RegExp(`${SECTION_DIVIDER}$`), '').trim();
      return { title, body };
    });
}
