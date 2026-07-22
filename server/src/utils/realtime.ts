import { io } from '../server';

export type DateUpdatedPayload = { dateId: string; status: string };

export function emitDateUpdated(payload: DateUpdatedPayload): void {
  io.emit('date-updated', payload);
}

export function emitDateUpdatedMany(items: DateUpdatedPayload[]): void {
  items.forEach(emitDateUpdated);
}

export function emitBookingUpdated(bookingId?: string): void {
  io.emit('booking-updated', bookingId ? { bookingId } : {});
}

export function emitSettingsUpdated(): void {
  io.emit('settings-updated', {});
}

export function emitEventFormsUpdated(): void {
  io.emit('event-forms-updated', {});
}

export function emitMenuUpdated(payload: unknown): void {
  io.emit('menuUpdated', payload);
}

export function emitCheckInUpdated(bookingId: string): void {
  io.emit('check-in-updated', { bookingId });
}

export function emitFeedbackUpdated(payload?: { bookingId?: string }): void {
  io.emit('feedback-updated', payload ?? {});
}
