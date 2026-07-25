import { useEffect } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import styles from './DesignImageLightbox.module.css';

type Props = {
  src: string | null;
  alt?: string;
  caption?: string;
  onClose: () => void;
};

export function DesignImageLightbox({ src, alt = '', caption, onClose }: Props) {
  const { t, T } = useTranslation();

  useEffect(() => {
    if (!src) return;
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
  }, [src, onClose]);

  if (!src) return null;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={t(T.EVENT_FORM.DESIGN_LIGHTBOX_ARIA)}
      onClick={onClose}
    >
      <button
        type="button"
        className={styles.closeBtn}
        onClick={onClose}
        aria-label={t(T.BOOKING.CONTRACT.CLOSE)}
      >
        ✕
      </button>
      <figure className={styles.figure} onClick={(e) => e.stopPropagation()}>
        <img src={src} alt={alt} className={styles.image} />
        {caption ? <figcaption className={styles.caption}>{caption}</figcaption> : null}
      </figure>
    </div>
  );
}

export default DesignImageLightbox;
