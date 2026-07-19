import { useTranslation } from '../../i18n/useTranslation';
import { Badge, type BadgeVariant } from './Badge';
import { Button } from './Button';
import styles from './EventCard.module.css';

export interface EventCardData {
  id: string | number;
  date: string;
  code?: string;
  clientName: string;
  clientNameB?: string;
  eventType: string;
  timeOfDay?: string;
  guestCount?: number | string;
  status?: BadgeVariant;
  statusLabel?: string;
}

interface EventCardProps {
  event: EventCardData;
  onView?: () => void;
  viewLabel?: string;
}

export function EventCard({ event, onView, viewLabel }: EventCardProps) {
  const { t, T } = useTranslation();
  const resolvedViewLabel = viewLabel ?? t(T.UI.VIEW_DETAILS);

  return (
    <article className={styles.card}>
      <div className={styles.header}>
        <time className={styles.date} dateTime={event.date}>
          {event.date}
        </time>
        {event.code && <span className={styles.code}>#{event.code}</span>}
        {event.status && event.statusLabel && (
          <Badge variant={event.status}>{event.statusLabel}</Badge>
        )}
      </div>

      <h3 className={styles.name}>{event.clientName}</h3>
      {event.clientNameB && <p className={styles.nameSecondary}>{event.clientNameB}</p>}

      <dl className={styles.details}>
        <div className={styles.detailRow}>
          <dt>{t(T.COMMON.LABELS.TYPE)}</dt>
          <dd>{event.eventType}{event.timeOfDay ? ` | ${event.timeOfDay}` : ''}</dd>
        </div>
        {event.guestCount !== undefined && (
          <div className={styles.detailRow}>
            <dt>{t(T.COMMON.LABELS.GUESTS)}</dt>
            <dd>{event.guestCount}</dd>
          </div>
        )}
      </dl>

      {onView && (
        <Button variant="primary" size="sm" fullWidth onClick={onView}>
          {resolvedViewLabel}
        </Button>
      )}
    </article>
  );
}
