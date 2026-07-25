import { describe, expect, it } from 'vitest';
import { formatCurrency, formatNumber } from '@shared/i18n/formatters';

describe('shared i18n formatters', () => {
  it('formats numbers for he locale', () => {
    const formatted = formatNumber(1234, 'he');
    expect(formatted.replace(/[^\d]/g, '')).toContain('1234');
  });

  it('formats ILS currency without fraction digits', () => {
    const formatted = formatCurrency(5000, 'he');
    expect(formatted.replace(/[^\d]/g, '')).toContain('5000');
  });
});
