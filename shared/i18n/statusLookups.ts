import { T, type TranslationKey } from './keys';

/** API enum values — labels come from i18n keys only */
export type ApiBookingStatus = 'BOOKED' | 'OPTION';

export const API_BOOKING_STATUS_KEYS: Record<ApiBookingStatus, TranslationKey> = {
  BOOKED: T.STATUS.CONFIRMED,
  OPTION: T.STATUS.OPTION,
};

export const BOOKING_STATUS_KEYS = {
  confirmed: T.STATUS.CONFIRMED,
  past: T.STATUS.PAST,
  option: T.STATUS.OPTION,
} as const satisfies Record<string, TranslationKey>;

export function formatApiBookingStatus(
  translate: (key: TranslationKey) => string,
  status: ApiBookingStatus | string,
): string {
  const key = API_BOOKING_STATUS_KEYS[status as ApiBookingStatus];
  return key ? translate(key) : status;
}

export const DEPOSIT_METHOD_KEYS: Record<string, TranslationKey> = {
  credit_card: T.DEPOSIT_METHOD.CREDIT_CASH,
  check_capture: T.DEPOSIT_METHOD.CHECK_CAPTURE,
  check_upload: T.DEPOSIT_METHOD.CHECK_UPLOAD,
};

export const EASYCOUNT_STATUS_KEYS: Record<string, TranslationKey> = {
  SIMULATED: T.EASYCOUNT.SIMULATED,
  ISSUED: T.EASYCOUNT.ISSUED,
  FAILED: T.EASYCOUNT.FAILED,
  SKIPPED: T.EASYCOUNT.SKIPPED,
};

export const DEFAULT_EASYCOUNT_STATUS_KEY = T.EASYCOUNT.PENDING;

export function formatEasyCountStatusLabel(
  translate: (key: TranslationKey) => string,
  status?: string | null,
): string {
  if (!status) return translate(DEFAULT_EASYCOUNT_STATUS_KEY);
  const key = EASYCOUNT_STATUS_KEYS[status];
  return key ? translate(key) : status;
}

export function formatDepositMethodLabel(
  translate: (key: TranslationKey) => string,
  method?: string | null,
): string {
  if (!method) return '';
  const key = DEPOSIT_METHOD_KEYS[method];
  return key ? translate(key) : method;
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

export function canForceReissueEasyCountReceipt(booking: {
  advancePaid?: number | null;
  isOption?: boolean;
  easycountStatus?: string | null;
}): boolean {
  if (booking.isOption) return false;
  if (!booking.advancePaid || booking.advancePaid <= 0) return false;
  return booking.easycountStatus === 'SIMULATED' || booking.easycountStatus === 'ISSUED';
}
