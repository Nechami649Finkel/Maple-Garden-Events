interface DraftEnvelope<T> {
  savedAt: number;
  userEmail: string;
  data: T;
}

export function saveLocalDraft<T>(
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
    localStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // quota exceeded or private browsing — ignore
  }
}

export function loadLocalDraft<T>(
  key: string,
  currentUserEmail: string,
  ttlMs: number,
): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const { savedAt, userEmail, data } = JSON.parse(raw) as DraftEnvelope<T>;

    if (userEmail !== currentUserEmail) {
      localStorage.removeItem(key);
      return null;
    }

    if (Date.now() - savedAt > ttlMs) {
      localStorage.removeItem(key);
      return null;
    }

    return data;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

export function clearLocalDraft(key: string): void {
  localStorage.removeItem(key);
}

export function cleanExpiredLocalDrafts(ttlMs: number = 24 * 60 * 60 * 1000): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('maple-draft:')) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const { savedAt } = JSON.parse(raw) as DraftEnvelope<unknown>;
            if (Date.now() - savedAt > ttlMs) {
              keysToRemove.push(key);
            }
          }
        } catch {
          keysToRemove.push(key);
        }
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch {
    // ignore
  }
}
