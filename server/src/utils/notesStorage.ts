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

  return { menu: [], internal: [raw.trim()] };
}
