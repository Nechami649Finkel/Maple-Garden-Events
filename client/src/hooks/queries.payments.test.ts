import { describe, expect, it } from 'vitest';
import { bookingPaymentsQueryKey } from './queries';

describe('bookingPaymentsQueryKey', () => {
  it('builds a stable TanStack Query key for a booking ledger', () => {
    expect(bookingPaymentsQueryKey('booking-123')).toEqual([
      'booking-payments',
      'booking-123',
    ]);
  });
});
