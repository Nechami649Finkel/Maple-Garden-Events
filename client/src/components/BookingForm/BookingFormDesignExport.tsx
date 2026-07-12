import BookingForm from './BookingForm';

/**
 * Dev-only full-page preview of the booking close form for design exports.
 * Route: /__design__/booking-form (no auth required in development)
 */
export default function BookingFormDesignExport() {
  return (
    <BookingForm
      initialDates={[{ date: '2026-09-15', hebrewDate: 'כ״ג באלול תשפ״ו' }]}
    />
  );
}
