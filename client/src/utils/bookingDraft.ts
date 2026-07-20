import type { UpgradeKey } from './pricing';
import {
  clearLocalDraft,
  loadLocalDraft,
  saveLocalDraft,
} from './localDraft';

const DRAFT_KEY_EVENT = 'maple-draft:booking:event';
const DRAFT_KEY_OPTION = 'maple-draft:booking:option';
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

export interface BookingDraftSnapshot {
  formData: Record<string, unknown>;
  menuNotesList: string[];
  internalNotesList: string[];
  servingStyle: string;
  kosherType: string;
  upgrades: Record<UpgradeKey, boolean>;
  depositMethod: string;
  contractSigned: boolean;
  selectedDatesDisplay: unknown[];
  isOption: boolean;
  optionDurationHours: number;
  paymentTemplateId: string;
  paymentTermsCustom: boolean;
  paymentTermsText: string;
}

function getDraftKey(isOption: boolean): string {
  return isOption ? DRAFT_KEY_OPTION : DRAFT_KEY_EVENT;
}

export function saveBookingDraft(
  userEmail: string,
  isOption: boolean,
  data: BookingDraftSnapshot,
): void {
  saveLocalDraft(getDraftKey(isOption), userEmail, data);
}

export function loadBookingDraft(
  userEmail: string,
  isOption: boolean,
): BookingDraftSnapshot | null {
  return loadLocalDraft<BookingDraftSnapshot>(
    getDraftKey(isOption),
    userEmail,
    DRAFT_TTL_MS,
  );
}

export function clearBookingDraft(isOption: boolean): void {
  clearLocalDraft(getDraftKey(isOption));
}
