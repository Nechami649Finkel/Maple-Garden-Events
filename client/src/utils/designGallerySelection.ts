import type { DesignFormField } from '@shared/gallery';
import {
  loadEventFormDraft,
  saveEventFormDraft,
  type EventFormDraftSnapshot,
} from './eventFormDraft';

const PENDING_DESIGN_KEY = 'eventFormPendingDesignSelections';

export type PendingDesignSelections = {
  bookingId: string;
  fields: Partial<Record<DesignFormField, string>>;
};

export function readPendingDesignSelections(): PendingDesignSelections | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(PENDING_DESIGN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingDesignSelections;
    if (!parsed?.bookingId || typeof parsed.fields !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingDesignSelections(): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(PENDING_DESIGN_KEY);
}

/** Persist a gallery pick so EventFormManager can merge it after restore. */
export function recordDesignSelection(params: {
  bookingId: string;
  field: DesignFormField;
  value: string;
  userEmail?: string | null;
}): void {
  const existing = readPendingDesignSelections();
  const next: PendingDesignSelections = {
    bookingId: params.bookingId,
    fields: {
      ...(existing?.bookingId === params.bookingId ? existing.fields : {}),
      [params.field]: params.value,
    },
  };
  sessionStorage.setItem(PENDING_DESIGN_KEY, JSON.stringify(next));

  if (!params.userEmail) return;
  const draft = loadEventFormDraft(params.bookingId, params.userEmail);
  if (!draft) return;
  const formData = {
    ...(draft.formData as Record<string, unknown>),
    [params.field]: params.value,
  };
  const snapshot: EventFormDraftSnapshot = { ...draft, formData };
  saveEventFormDraft(params.bookingId, params.userEmail, snapshot);
}

export function consumePendingDesignSelections(
  bookingId: string,
): Partial<Record<DesignFormField, string>> | null {
  const pending = readPendingDesignSelections();
  if (!pending || pending.bookingId !== bookingId) return null;
  clearPendingDesignSelections();
  return pending.fields;
}
