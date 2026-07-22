import { useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import styles from './NotesList.module.css';

interface NotesListProps {
  notes: string[];
  onChange?: (notes: string[]) => void;
  placeholder?: string;
  emptyText?: string;
}

export const NotesList = ({
  notes,
  onChange,
  placeholder,
  emptyText,
}: NotesListProps) => {
  const { t, T } = useTranslation();
  const [newNote, setNewNote] = useState('');
  const readOnly = !onChange;
  const resolvedPlaceholder = placeholder ?? t(T.BOOKING.NOTES.INTERNAL_PLACEHOLDER);

  const addNote = () => {
    const trimmed = newNote.trim();
    if (!trimmed || !onChange) return;
    onChange([...notes, trimmed]);
    setNewNote('');
  };

  const removeNote = (index: number) => {
    if (!onChange) return;
    onChange(notes.filter((_, i) => i !== index));
  };

  return (
    <div className={styles.notesContainer}>
      {notes.length > 0 ? (
        <div className={styles.notesList}>
          {notes.map((note, idx) => (
            <div key={idx} className={styles.noteItem}>
              <span className={styles.noteNumber}>{idx + 1}.</span>
              <span className={styles.noteText}>{note}</span>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => removeNote(idx)}
                  className={styles.removeNoteBtn}
                  aria-label={t(T.UI.REMOVE)}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        readOnly && emptyText ? <p className={styles.emptyText}>{emptyText}</p> : null
      )}

      {!readOnly && (
        <div className={styles.addNoteRow}>
          <input
            type="text"
            placeholder={resolvedPlaceholder}
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addNote();
              }
            }}
            className={styles.noteInput}
          />
          <button type="button" onClick={addNote} className={styles.addNoteBtn}>
            + {t(T.EVENT_FORM.ADD_NOTE)}
          </button>
        </div>
      )}
    </div>
  );
};
