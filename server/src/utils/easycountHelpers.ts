/**
 * Presentation helpers for EasyCount statuses.
 * Core issuance / ledger logic lives in Services/easyCount.
 */

import {
  canIssueEasyCountReceipt,
  formatEasyCountUserMessage,
  getEasyCountMeta,
  type EasyCountIssueResult,
  type EasyCountMode,
} from '../Services/easyCount';

export {
  canIssueEasyCountReceipt,
  formatEasyCountUserMessage,
  getEasyCountMeta,
  type EasyCountIssueResult,
  type EasyCountMode,
};

export function formatEasyCountStatusLabel(status?: string | null): string {
  switch (status) {
    case 'SIMULATED':
      return 'סימולציה (לא מסמך אמיתי)';
    case 'ISSUED':
      return 'קבלה הופקה';
    case 'FAILED':
      return 'שגיאה בהפקה';
    case 'SKIPPED':
      return 'דולג';
    default:
      return 'טרם הופקה';
  }
}

export function canRetryEasyCountReceipt(booking: {
  advancePaid?: number | null;
  isOption?: boolean;
  easycountStatus?: string | null;
}): boolean {
  if (booking.isOption) return false;
  if (!booking.advancePaid || booking.advancePaid <= 0) return false;
  return !booking.easycountStatus || booking.easycountStatus === 'FAILED';
}
