import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n/useTranslation';
import { useNavigationOverride } from '../../context/navigationContext';
import { DesignGalleryPicker } from '../DesignGallery/DesignGalleryPicker';
import { getAuthUser } from '../../services/api';
import { recordDesignSelection } from '../../utils/designGallerySelection';
import type { DesignFormField } from '@shared/gallery';
import styles from './Gallery.module.css';

const Gallery = () => {
  const { t, T } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const galleryState = location.state as {
    fromEventForm?: boolean;
    bookingId?: string;
  } | null;

  const fromEventForm = Boolean(galleryState?.fromEventForm || galleryState?.bookingId);
  const bookingId =
    galleryState?.bookingId ||
    (typeof sessionStorage !== 'undefined'
      ? sessionStorage.getItem('eventFormReturnBookingId')
      : null);

  const handleBackToEventForm = useCallback(() => {
    navigate('/event-form-manager', {
      state: bookingId ? { bookingId, restoreEventForm: true } : { restoreEventForm: true },
    });
  }, [bookingId, navigate]);

  const navigationOverride = useMemo(
    () => (fromEventForm ? { onBack: handleBackToEventForm } : null),
    [fromEventForm, handleBackToEventForm],
  );

  useNavigationOverride(navigationOverride);

  const handleSelect = useCallback(
    async (field: DesignFormField, value: string) => {
      if (!fromEventForm || !bookingId) return;
      const user = await getAuthUser();
      recordDesignSelection({
        bookingId,
        field,
        value,
        userEmail: user?.email,
      });
    },
    [bookingId, fromEventForm],
  );

  return (
    <div className={styles.galleryContainer}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t(T.NAV.GALLERY)}</h1>
        <p className={styles.subtitle}>
          {fromEventForm
            ? t(T.EVENT_FORM.DESIGN_PICKER_HINT)
            : t(T.SETTINGS.DESIGN_GALLERY_HINT)}
        </p>
      </div>

      <DesignGalleryPicker onSelect={handleSelect} />
    </div>
  );
};

export default Gallery;
