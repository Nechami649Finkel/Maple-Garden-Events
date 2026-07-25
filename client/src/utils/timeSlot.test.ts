import { describe, expect, it } from 'vitest';
import {
  getDefaultTimeSlot,
  normalizeTimeSlot,
  sortSlotsForDisplay,
} from './timeSlot';

describe('normalizeTimeSlot', () => {
  it('normalizes English and Hebrew labels', () => {
    expect(normalizeTimeSlot('morning')).toBe('morning');
    expect(normalizeTimeSlot('ערב')).toBe('evening');
    expect(normalizeTimeSlot('צהריים')).toBe('noon');
  });

  it('infers slot from clock hour', () => {
    expect(normalizeTimeSlot(null, '09:30')).toBe('morning');
    expect(normalizeTimeSlot(null, '14:00')).toBe('noon');
    expect(normalizeTimeSlot(null, '20:15')).toBe('evening');
  });

  it('parses slot|hours composite values', () => {
    expect(normalizeTimeSlot('evening|18:00 - 00:00')).toBe('evening');
  });
});

describe('getDefaultTimeSlot / sortSlotsForDisplay', () => {
  it('prefers evening when available', () => {
    expect(getDefaultTimeSlot(['morning', 'evening'])).toBe('evening');
  });

  it('sorts slots in display order', () => {
    expect(sortSlotsForDisplay(['noon', 'evening', 'morning'])).toEqual([
      'evening',
      'morning',
      'noon',
    ]);
  });
});
