import React, { useState } from 'react';
import { useFeedbackAdminQuery } from '../../hooks/queries';
import { PaginationBar } from '../PaginationBar/PaginationBar';
import styles from './FeedbackManager.module.css';

type FeedbackSide = {
  id: string;
  clientSide: string;
  clientName: string | null;
  foodRating: number | null;
  serviceRating: number | null;
  venueRating: number | null;
  averageScore: number | null;
  comments: string | null;
  isCompleted: boolean;
};

type FeedbackGroup = {
  bookingId: string;
  eventCode: string;
  eventType: string;
  eventDate: string | null;
  clientAFullName: string;
  clientBFullName: string | null;
  sides: FeedbackSide[];
  combinedAverage: number | null;
  allCompleted: boolean;
};

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso + 'T12:00:00').toLocaleDateString('he-IL');
}

function stars(score: number | null) {
  if (score == null) return '—';
  return '★'.repeat(Math.round(score)) + '☆'.repeat(5 - Math.round(score));
}

const FeedbackManager = () => {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all');

  const { data, isLoading: loading } = useFeedbackAdminQuery(page, 20);
  const groups = data?.data ?? [];
  const pagination = data?.pagination;

  const filtered = (groups as FeedbackGroup[]).filter((g) => {
    if (filter === 'pending') return g.sides.some((s) => !s.isCompleted);
    if (filter === 'done') return g.allCompleted;
    return true;
  });

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>משובי לקוחות</h2>
        <p className={styles.subtitle}>
          משובים נשלחים אוטומטית למייל/וואטסאפ בבוקר שאחרי האירוע. בחתונה/אירוסין — לשני הצדדים.
        </p>
      </div>

      <div className={styles.filters}>
        <button
          type="button"
          className={filter === 'all' ? styles.filterActive : styles.filterBtn}
          onClick={() => setFilter('all')}
        >
          הכל
        </button>
        <button
          type="button"
          className={filter === 'pending' ? styles.filterActive : styles.filterBtn}
          onClick={() => setFilter('pending')}
        >
          ממתין למילוי
        </button>
        <button
          type="button"
          className={filter === 'done' ? styles.filterActive : styles.filterBtn}
          onClick={() => setFilter('done')}
        >
          הושלם
        </button>
      </div>

      {loading ? (
        <p className={styles.empty}>טוען...</p>
      ) : filtered.length === 0 ? (
        <p className={styles.empty}>אין משובים להצגה. משובים יופיעו לאחר אירועים שהסתיימו.</p>
      ) : (
        <>
          <div className={styles.list}>
            {filtered.map((g: FeedbackGroup) => (
            <article key={g.bookingId} className={styles.card}>
              <header className={styles.cardHeader}>
                <div>
                  <span className={styles.eventCode}>#{g.eventCode}</span>
                  <h3 className={styles.eventTitle}>
                    {g.eventType} — {formatDate(g.eventDate)}
                  </h3>
                  <p className={styles.clients}>
                    {g.clientAFullName}
                    {g.clientBFullName ? ` · ${g.clientBFullName}` : ''}
                  </p>
                </div>
                <div className={styles.combinedBox}>
                  <span className={styles.combinedLabel}>ממוצע משולב</span>
                  <strong className={styles.combinedScore}>
                    {g.combinedAverage != null ? g.combinedAverage.toFixed(1) : '—'}
                  </strong>
                  {g.allCompleted && g.sides.length > 1 && (
                    <span className={styles.badgeDone}>שני הצדדים מילאו</span>
                  )}
                </div>
              </header>

              <div className={styles.sidesGrid}>
                {g.sides.map((side) => (
                  <div
                    key={side.id}
                    className={`${styles.sideCard} ${side.isCompleted ? styles.sideDone : styles.sidePending}`}
                  >
                    <div className={styles.sideHeader}>
                      <strong>צד {side.clientSide === 'B' ? "ב'" : "א'"}</strong>
                      <span>{side.clientName || '—'}</span>
                      <span className={side.isCompleted ? styles.statusDone : styles.statusPending}>
                        {side.isCompleted ? 'הושלם' : 'ממתין'}
                      </span>
                    </div>
                    {side.isCompleted ? (
                      <>
                        <div className={styles.ratings}>
                          <span>אוכל: {stars(side.foodRating)}</span>
                          <span>שירות: {stars(side.serviceRating)}</span>
                          <span>אולם: {stars(side.venueRating)}</span>
                        </div>
                        <p className={styles.avg}>ממוצע: {side.averageScore?.toFixed(1)}</p>
                        {side.comments && (
                          <p className={styles.comments}>"{side.comments}"</p>
                        )}
                      </>
                    ) : (
                      <p className={styles.waiting}>טרם התקבל משוב</p>
                    )}
                  </div>
                ))}
              </div>
            </article>
            ))}
          </div>
          {pagination && (
            <PaginationBar
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </div>
  );
};

export default FeedbackManager;
