import { secureFetch } from '../services/api';
import { API_URL } from '../config/api';

const QUEUE_KEY = 'maple-offline-checkin-queue';

export interface CheckInQueuePayload {
  familiesLabel?: string;
  orderedPortions?: number | null;
  entertainerPortions?: number | null;
  reservePortions?: number | null;
  reserveTables?: unknown;
  specialAdditions?: string;
  customerSignature?: string | null;
}

export interface CheckInQueueItem {
  id: string;
  bookingId: string;
  payload: CheckInQueuePayload;
  queuedAt: number;
}

function readQueue(): CheckInQueueItem[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(items: CheckInQueueItem[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch {
    // ignore quota errors
  }
}

export function getOfflineCheckInQueue(): CheckInQueueItem[] {
  return readQueue();
}

export function getPendingCheckInCount(): number {
  return readQueue().length;
}

export function enqueueCheckIn(
  bookingId: string,
  payload: CheckInQueuePayload,
): CheckInQueueItem {
  const item: CheckInQueueItem = {
    id: `${bookingId}-${Date.now()}`,
    bookingId,
    payload,
    queuedAt: Date.now(),
  };
  const queue = readQueue().filter((q) => q.bookingId !== bookingId);
  queue.push(item);
  writeQueue(queue);
  return item;
}

export function removeFromCheckInQueue(itemId: string): void {
  writeQueue(readQueue().filter((q) => q.id !== itemId));
}

export async function syncOfflineCheckInQueue(): Promise<{
  synced: number;
  failed: number;
}> {
  const queue = readQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;
  const remaining: CheckInQueueItem[] = [];

  for (const item of queue) {
    try {
      const response = await secureFetch(`${API_URL}/check-in/${item.bookingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.payload),
      });
      const res = await response.json();
      if (response.ok && res.success) {
        synced += 1;
      } else {
        failed += 1;
        remaining.push(item);
      }
    } catch {
      failed += 1;
      remaining.push(item);
    }
  }

  writeQueue(remaining);
  return { synced, failed };
}

let syncListenerAttached = false;

export function setupOfflineCheckInSync(onSynced?: (result: { synced: number; failed: number }) => void): void {
  if (syncListenerAttached || typeof window === 'undefined') return;
  syncListenerAttached = true;

  const runSync = () => {
    if (!navigator.onLine || getPendingCheckInCount() === 0) return;
    syncOfflineCheckInQueue().then((result) => {
      if (result.synced > 0) onSynced?.(result);
    });
  };

  window.addEventListener('online', runSync);
  runSync();
}
