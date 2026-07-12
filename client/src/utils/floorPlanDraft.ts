import type { TableData } from '../constants/defaultTableLayout';
import {
  clearSessionDraft,
  loadSessionDraft,
  saveSessionDraft,
} from './sessionDraft';

const DRAFT_PREFIX = 'maple-draft:floorplan:';
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

function draftKey(eventId: string): string {
  return `${DRAFT_PREFIX}${eventId}`;
}

export function saveFloorPlanDraft(
  eventId: string,
  userEmail: string,
  tables: TableData[],
): void {
  saveSessionDraft(draftKey(eventId), userEmail, tables);
}

export function loadFloorPlanDraft(
  eventId: string,
  userEmail: string,
): TableData[] | null {
  return loadSessionDraft<TableData[]>(
    draftKey(eventId),
    userEmail,
    DRAFT_TTL_MS,
  );
}

export function clearFloorPlanDraft(eventId: string): void {
  clearSessionDraft(draftKey(eventId));
}
