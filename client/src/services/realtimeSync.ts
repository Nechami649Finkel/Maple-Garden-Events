import type { QueryClient } from '@tanstack/react-query';
import { socket } from './socketService';

export const REALTIME_DATE_UPDATED_EVENT = 'realtime:date-updated';

let active = false;

function invalidateCalendarAndBookings(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: ['calendar'] });
  queryClient.invalidateQueries({ queryKey: ['bookings'] });
  window.dispatchEvent(new CustomEvent(REALTIME_DATE_UPDATED_EVENT));
}

function onDateUpdated(queryClient: QueryClient): void {
  invalidateCalendarAndBookings(queryClient);
  queryClient.invalidateQueries({ queryKey: ['cancellation-stats'] });
}

function onBookingUpdated(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: ['bookings'] });
  queryClient.invalidateQueries({ queryKey: ['calendar'] });
}

function onSettingsUpdated(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: ['settings'] });
  queryClient.invalidateQueries({ queryKey: ['kashrut'] });
}

function onEventFormsUpdated(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: ['event-forms'] });
  queryClient.invalidateQueries({ queryKey: ['bookings'] });
  queryClient.invalidateQueries({ queryKey: ['calendar'] });
}

function onCheckInUpdated(queryClient: QueryClient, payload?: { bookingId?: string }): void {
  if (payload?.bookingId) {
    queryClient.invalidateQueries({ queryKey: ['check-in', payload.bookingId] });
  } else {
    queryClient.invalidateQueries({ queryKey: ['check-in'] });
  }
  queryClient.invalidateQueries({ queryKey: ['bookings'] });
  queryClient.invalidateQueries({ queryKey: ['calendar'] });
}

function onFeedbackUpdated(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: ['feedback-admin'] });
  queryClient.invalidateQueries({ queryKey: ['feedback-stats'] });
}

function onMenuUpdated(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: ['menu'] });
}

export function setupRealtimeSync(queryClient: QueryClient): void {
  if (active) return;
  active = true;

  const handlers = {
    'date-updated': () => onDateUpdated(queryClient),
    'booking-updated': () => onBookingUpdated(queryClient),
    'settings-updated': () => onSettingsUpdated(queryClient),
    'event-forms-updated': () => onEventFormsUpdated(queryClient),
    'check-in-updated': (payload?: { bookingId?: string }) => onCheckInUpdated(queryClient, payload),
    'feedback-updated': () => onFeedbackUpdated(queryClient),
    menuUpdated: () => onMenuUpdated(queryClient),
  };

  Object.entries(handlers).forEach(([event, handler]) => {
    socket.on(event, handler as (...args: unknown[]) => void);
  });

  (socket as typeof socket & { __realtimeHandlers?: typeof handlers }).__realtimeHandlers = handlers;
}

export function teardownRealtimeSync(): void {
  if (!active) return;
  const handlers = (socket as typeof socket & { __realtimeHandlers?: Record<string, () => void> }).__realtimeHandlers;
  if (handlers) {
    Object.entries(handlers).forEach(([event, handler]) => {
      socket.off(event, handler);
    });
  }
  active = false;
}
