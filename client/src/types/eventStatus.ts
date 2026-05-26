export const EventStatus = {
  AVAILABLE: 'AVAILABLE',
  CHECKING: 'CHECKING',
  OPTION: 'OPTION',
  BOOKED: 'BOOKED',
  BLOCKED: 'BLOCKED',
  FORBIDDEN: 'FORBIDDEN'
} as const;

export type EventStatus = typeof EventStatus[keyof typeof EventStatus];