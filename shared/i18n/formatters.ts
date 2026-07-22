import type { Locale } from './types';

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale).format(value);
}

export function formatCurrency(value: number, locale: Locale, currency = 'ILS'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(
  value: Date | string | number,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(locale, options).format(date);
}

export function formatDateTime(
  value: Date | string | number,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions,
): string {
  return formatDate(value, locale, {
    dateStyle: 'short',
    timeStyle: 'short',
    ...options,
  });
}
