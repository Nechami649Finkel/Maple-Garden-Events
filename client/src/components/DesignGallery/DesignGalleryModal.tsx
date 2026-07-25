import { useEffect } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { DesignGalleryPicker } from './DesignGalleryPicker';
import type { DesignFormField, DesignGalleryItemDto } from '@shared/gallery';
import styles from './DesignGalleryModal.module.css';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  selectedValues: Partial<Record<DesignFormField, string>>;
  onSelect: (field: DesignFormField, value: string, item: DesignGalleryItemDto) => void;
};

export function DesignGalleryModal({ isOpen, onClose, selectedValues, onSelect }: Props) {
  const { t, T } = useTranslation();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>{t(T.EVENT_FORM.SECTION_DESIGNS_GALLERY)}</h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label={t(T.BOOKING.CONTRACT.CLOSE)}
          >
            ✕
          </button>
        </div>
        <div className={styles.body}>
          <DesignGalleryPicker
            selectedValues={selectedValues}
            onSelect={onSelect}
            showSelectedTab
          />
        </div>
        <div className={styles.footer}>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            {t(T.EVENT_FORM.DESIGN_DONE)}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DesignGalleryModal;
