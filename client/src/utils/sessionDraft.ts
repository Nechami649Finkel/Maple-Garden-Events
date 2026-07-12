interface DraftEnvelope<T> {
  savedAt: number;
  userEmail: string;
  data: T;
}

export function saveSessionDraft<T>(
  key: string,
  userEmail: string,
  data: T,
): void {
  const envelope: DraftEnvelope<T> = {
    savedAt: Date.now(),
    userEmail,
    data,
  };
  try {
    sessionStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // quota exceeded or private browsing — ignore
  }
}

export function loadSessionDraft<T>(
  key: string,
  currentUserEmail: string,
  ttlMs: number,
): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;

    const { savedAt, userEmail, data } = JSON.parse(raw) as DraftEnvelope<T>;

    if (userEmail !== currentUserEmail) {
      sessionStorage.removeItem(key);
      return null;
    }

    if (Date.now() - savedAt > ttlMs) {
      sessionStorage.removeItem(key);
      return null;
    }

    return data;
  } catch {
    sessionStorage.removeItem(key);
    return null;
  }
}

export function clearSessionDraft(key: string): void {
  sessionStorage.removeItem(key);
}
