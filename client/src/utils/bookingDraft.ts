import type { UpgradeKey } from './pricing';
import {
  clearSessionDraft,
  loadSessionDraft,
  saveSessionDraft,
} from './sessionDraft';

const DRAFT_KEY = 'maple-draft:booking:current';
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

export function saveBookingDraft(
  userEmail: string,
  data: BookingDraftSnapshot,
): void {
  saveSessionDraft(DRAFT_KEY, userEmail, data);
}

export function loadBookingDraft(
  userEmail: string,
): BookingDraftSnapshot | null {
  return loadSessionDraft<BookingDraftSnapshot>(
    DRAFT_KEY,
    userEmail,
    DRAFT_TTL_MS,
  );
}

export function clearBookingDraft(): void {
  clearSessionDraft(DRAFT_KEY);
}
