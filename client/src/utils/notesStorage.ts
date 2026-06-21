export type NotesBundle = {
  menu: string[];
  internal: string[];
};

function filterNotes(notes: unknown): string[] {
  if (!Array.isArray(notes)) return [];
  return notes
    .filter((note): note is string => typeof note === 'string')
    .map((note) => note.trim())
    .filter(Boolean);
}

export function parseNotes(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return filterNotes(parsed);
  } catch {
    // legacy plain text
  }

  return [raw.trim()];
}

export function parseNotesBundle(raw: string | null | undefined): NotesBundle {
  if (!raw?.trim()) return { menu: [], internal: [] };

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      if ('menu' in parsed || 'internal' in parsed) {
        return {
          menu: filterNotes(parsed.menu),
          internal: filterNotes(parsed.internal),
        };
      }
    }
    if (Array.isArray(parsed)) {
      return { menu: [], internal: filterNotes(parsed) };
    }
  } catch {
    // legacy plain text
  }

  const menuMatch = raw.match(/\n\n\[הערות תפריט\]:\s*([\s\S]+)$/);
  if (menuMatch) {
    const before = raw.replace(/\n\n\[הערות תפריט\]:[\s\S]+$/, '').trim();
    return {
      internal: before ? [before] : [],
      menu: [menuMatch[1].trim()],
    };
  }

  return { menu: [], internal: [raw.trim()] };
}

export function serializeNotes(notes: string[]): string | null {
  const filtered = filterNotes(notes);
  if (!filtered.length) return null;
  return JSON.stringify(filtered);
}

export function serializeNotesBundle(bundle: NotesBundle): string | null {
  const menu = filterNotes(bundle.menu);
  const internal = filterNotes(bundle.internal);
  if (!menu.length && !internal.length) return null;
  return JSON.stringify({ menu, internal });
}
