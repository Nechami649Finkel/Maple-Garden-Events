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
  resolveEffectiveUpgrades,
  stripAnnexUpgradeSections,
  type ExtrasLineItem,
} from '../../../shared/contract';

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
  resolveEffectiveUpgrades,
  stripAnnexUpgradeSections,
  type ExtrasLineItem,
};

/** @deprecated use buildSelectedLineItems */
export { buildSelectedLineItems as buildExtrasLineItems } from '../../../shared/contract';

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
