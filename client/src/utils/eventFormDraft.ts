import {
  clearLocalDraft,
  loadLocalDraft,
  saveLocalDraft,
} from './localDraft';

const DRAFT_PREFIX = 'maple-draft:event-form:';
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface EventFormDraftSnapshot {
  formData: Record<string, unknown>;
  hasHonorTable: boolean | null;
  hasEntertainers: boolean | null;
  notesList: string[];
  selectedMenu: Record<string, string[]> | null;
}

function draftKey(eventId: string): string {
  return `${DRAFT_PREFIX}${eventId}`;
}

export function saveEventFormDraft(
  eventId: string,
  userEmail: string,
  data: EventFormDraftSnapshot,
): void {
  saveLocalDraft(draftKey(eventId), userEmail, data);
}

export function loadEventFormDraft(
  eventId: string,
  userEmail: string,
): EventFormDraftSnapshot | null {
  return loadLocalDraft<EventFormDraftSnapshot>(
    draftKey(eventId),
    userEmail,
    DRAFT_TTL_MS,
  );
}

export function clearEventFormDraft(eventId: string): void {
  clearLocalDraft(draftKey(eventId));
}
