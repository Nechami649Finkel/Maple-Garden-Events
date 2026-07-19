import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { formatDate, formatDateTime } from '@shared/i18n/formatters';
import { useFeedbackAdminQuery } from '../../hooks/queries';
import { API_URL } from '../../config/api';
import { apiFetch } from '../../services/api';
import { useTranslation } from '../../i18n/useTranslation';
import { PaginationBar } from '../PaginationBar/PaginationBar';
import styles from './FeedbackManager.module.css';

type FeedbackSide = {
  id: string | null;
  token: string | null;
  link: string | null;
  clientSide: string;
  clientName: string | null;
  foodRating: number | null;
  serviceRating: number | null;
  venueRating: number | null;
  averageScore: number | null;
  comments: string | null;
  isCompleted: boolean;
  lastNotifiedAt: string | null;
  lastEmailSent: boolean;
  lastWhatsappSent: boolean;
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
  feedbackStatus: 'not_sent' | 'pending' | 'completed';
};

type SendResult = {
  message: string;
  emailSent?: boolean;
  whatsappSent?: boolean;
  skippedReasons?: string[];
  results?: Array<{ link: string; clientSide: string; emailSent: boolean; whatsappSent: boolean; skippedReasons: string[] }>;
};

function stars(score: number | null, emDash: string) {
  if (score == null) return emDash;
  return '★'.repeat(Math.round(score)) + '☆'.repeat(5 - Math.round(score));
}

async function sendFeedbackRequest(
  bookingId: string,
  options?: { clientSide?: 'A' | 'B'; sendNotifications?: boolean },
): Promise<SendResult> {
  const res = await apiFetch(`${API_URL}/feedback/admin/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bookingId,
      clientSide: options?.clientSide,
      sendNotifications: options?.sendNotifications ?? true,
    }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message || 'SEND_FAILED');
  return json;
}

const FeedbackManager = () => {
  const { t, T, locale } = useTranslation();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deliveryNote, setDeliveryNote] = useState<{ bookingId: string; text: string } | null>(null);

  const emDash = t(T.COMMON.LABELS.EM_DASH);

  const formatEventDate = (iso: string | null) => {
    if (!iso) return emDash;
    return formatDate(iso + 'T12:00:00', locale);
  };

  const formatSentTime = (iso: string | null): string => {
    if (!iso) return '';
    return formatDateTime(iso, locale, {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const statusLabel = (status: FeedbackGroup['feedbackStatus'], sides: FeedbackSide[]) => {
    const anyNotified = sides.some((s) => s.lastNotifiedAt);
    if (status === 'not_sent') return t(T.FEEDBACK.STATUS_NOT_SENT);
    if (status === 'completed') return t(T.FEEDBACK.STATUS_COMPLETED);
    if (anyNotified) return t(T.FEEDBACK.STATUS_SENT_PENDING);
    return t(T.FEEDBACK.STATUS_PENDING);
  };

  const formatSentChannels = (side: FeedbackSide): string => {
    const parts: string[] = [];
    if (side.lastEmailSent) parts.push(t(T.COMMON.LABELS.SENT_EMAIL));
    if (side.lastWhatsappSent) parts.push(t(T.COMMON.LABELS.SENT_WHATSAPP));
    if (parts.length === 0) parts.push(t(T.COMMON.LABELS.SENT));
    return parts.join(' ');
  };

  const sendLabel = (sides: FeedbackSide[], isBusy: boolean): string => {
    if (isBusy) return t(T.FEEDBACK.SENDING);
    return sides.some((s) => s.lastNotifiedAt) ? t(T.FEEDBACK.SEND_AGAIN) : t(T.FEEDBACK.SEND);
  };

  const sideLabel = (clientSide: string): string =>
    clientSide === 'B' ? t(T.BOOKINGS.SIDE_B) : t(T.BOOKINGS.SIDE_A);

  const formatDeliveryResult = (result: SendResult): string => {
    const parts: string[] = [];
    if (result.emailSent) parts.push(t(T.COMMON.LABELS.SENT_EMAIL));
    if (result.whatsappSent) parts.push(t(T.COMMON.LABELS.SENT_WHATSAPP));
    if (result.skippedReasons?.length) {
      parts.push(...result.skippedReasons);
    }
    return parts.length > 0 ? parts.join('\n') : result.message;
  };

  const { data, isLoading: loading } = useFeedbackAdminQuery(page, 20);
  const groups = data?.data ?? [];
  const pagination = data?.pagination;

  const filtered = (groups as FeedbackGroup[]).filter((g) => {
    if (filter === 'pending') {
      return g.feedbackStatus === 'not_sent' || g.sides.some((s) => !s.isCompleted);
    }
    if (filter === 'done') return g.allCompleted;
    return true;
  });

  const handleSend = async (bookingId: string, clientSide?: 'A' | 'B') => {
    const key = clientSide ? `${bookingId}-${clientSide}` : bookingId;
    setBusyId(key);
    setDeliveryNote(null);
    try {
      const result = await sendFeedbackRequest(bookingId, { clientSide, sendNotifications: true });
      setDeliveryNote({ bookingId, text: formatDeliveryResult(result) });
      await queryClient.invalidateQueries({ queryKey: ['feedback-admin'] });
    } catch (err) {
      const msg = err instanceof Error && err.message !== 'SEND_FAILED' ? err.message : t(T.FEEDBACK.SEND_ERROR);
      alert(msg);
    } finally {
      setBusyId(null);
    }
  };

  const handleCopyLink = async (bookingId: string, clientSide?: 'A' | 'B') => {
    const key = `copy-${clientSide ? `${bookingId}-${clientSide}` : bookingId}`;
    setBusyId(key);
    try {
      const result = await sendFeedbackRequest(bookingId, { clientSide, sendNotifications: false });
      const link = result.results?.[0]?.link;
      if (!link) {
        alert(t(T.FEEDBACK.LINK_ERROR));
        return;
      }
      await navigator.clipboard.writeText(link);
      alert(t(T.FEEDBACK.LINK_COPIED));
      await queryClient.invalidateQueries({ queryKey: ['feedback-admin'] });
    } catch (err) {
      const msg = err instanceof Error && err.message !== 'SEND_FAILED' ? err.message : t(T.FEEDBACK.LINK_ERROR);
      alert(msg);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className={styles.container}>
        <div className={styles.header}>
        <div>
          <h2 className={styles.title}>{t(T.FEEDBACK.PAGE_TITLE)}</h2>
          <p className={styles.subtitle}>{t(T.FEEDBACK.PAGE_SUBTITLE)}</p>
        </div>
        <Link to="/feedback-stats" className={styles.statsLink}>
          📊 {t(T.FEEDBACK.STATS_LINK)}
        </Link>
      </div>

      <div className={styles.filters}>
        <button
          type="button"
          className={filter === 'all' ? styles.filterActive : styles.filterBtn}
          onClick={() => setFilter('all')}
        >
          {t(T.FEEDBACK.FILTER_ALL)}
        </button>
        <button
          type="button"
          className={filter === 'pending' ? styles.filterActive : styles.filterBtn}
          onClick={() => setFilter('pending')}
        >
          {t(T.FEEDBACK.FILTER_PENDING)}
        </button>
        <button
          type="button"
          className={filter === 'done' ? styles.filterActive : styles.filterBtn}
          onClick={() => setFilter('done')}
        >
          {t(T.FEEDBACK.FILTER_COMPLETED)}
        </button>
      </div>

      {loading ? (
        <p className={styles.empty}>{t(T.UI.LOADING)}</p>
      ) : filtered.length === 0 ? (
        <p className={styles.empty}>
          {groups.length === 0
            ? t(T.FEEDBACK.EMPTY_NO_EVENTS)
            : t(T.FEEDBACK.EMPTY_FILTER)}
        </p>
      ) : (
        <>
          <div className={styles.list}>
            {filtered.map((g: FeedbackGroup) => {
              const dualSide = g.sides.length > 1;
              const singleSide = g.sides.length === 1 ? g.sides[0] : null;
              const bulkBusy = busyId === g.bookingId;

              return (
              <article key={g.bookingId} className={styles.card}>
                <header className={styles.cardHeader}>
                  <div>
                    <span className={styles.eventCode}>#{g.eventCode}</span>
                    <h3 className={styles.eventTitle}>
                      {g.eventType} — {formatEventDate(g.eventDate)}
                    </h3>
                    <p className={styles.clients}>
                      {g.clientAFullName}
                      {g.clientBFullName ? ` · ${g.clientBFullName}` : ''}
                    </p>
                    <span className={`${styles.statusBadge} ${styles[`status_${g.feedbackStatus}`]}`}>
                      {statusLabel(g.feedbackStatus, g.sides)}
                    </span>
                  </div>
                  <div className={styles.combinedBox}>
                    {g.combinedAverage != null && (
                      <>
                        <span className={styles.combinedLabel}>
                          {dualSide ? t(T.FEEDBACK.AVERAGE_COMBINED) : t(T.FEEDBACK.AVERAGE)}
                        </span>
                        <strong className={styles.combinedScore}>
                          {g.combinedAverage.toFixed(1)}
                        </strong>
                      </>
                    )}
                    {g.allCompleted && dualSide && (
                      <span className={styles.badgeDone}>{t(T.FEEDBACK.BOTH_COMPLETED)}</span>
                    )}
                    {!dualSide && singleSide?.isCompleted && (
                      <span className={styles.badgeDone}>{t(T.FEEDBACK.STATUS_COMPLETED)}</span>
                    )}
                    {!g.allCompleted && dualSide && g.sides.length > 0 && (
                      <button
                        type="button"
                        className={`${styles.sendBtn}${g.combinedAverage == null ? ` ${styles.sendBtnAlone}` : ''}`}
                        disabled={bulkBusy}
                        onClick={() => handleSend(g.bookingId)}
                      >
                        {sendLabel(g.sides, bulkBusy)}
                      </button>
                    )}
                    {!dualSide && singleSide && !singleSide.isCompleted && (
                      <div className={styles.singleClientActions}>
                        {singleSide.lastNotifiedAt ? (
                          <div className={styles.sentStatus}>
                            <span className={styles.sentBadge}>{formatSentChannels(singleSide)}</span>
                            <span className={styles.sentTime}>{formatSentTime(singleSide.lastNotifiedAt)}</span>
                          </div>
                        ) : (
                          <p className={styles.waiting}>{t(T.FEEDBACK.STATUS_NOT_SENT)}</p>
                        )}
                        <div className={styles.sideActions}>
                          <button
                            type="button"
                            className={styles.copyBtn}
                            disabled={busyId === `copy-${g.bookingId}-A`}
                            onClick={() => handleCopyLink(g.bookingId, 'A')}
                          >
                            {t(T.FEEDBACK.COPY_LINK)}
                          </button>
                          <button
                            type="button"
                            className={`${styles.sendBtn} ${styles.sendBtnInline}`}
                            disabled={busyId === `${g.bookingId}-A`}
                            onClick={() => handleSend(g.bookingId, 'A')}
                          >
                            {sendLabel([singleSide], busyId === `${g.bookingId}-A`)}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </header>

                {deliveryNote?.bookingId === g.bookingId && (
                  <div className={styles.deliveryNote}>{deliveryNote.text}</div>
                )}

                {!dualSide && singleSide?.isCompleted && (
                  <div className={`${styles.sideCard} ${styles.sideDone}`}>
                    <div className={styles.ratings}>
                      <span>{t(T.FEEDBACK.RATING_FOOD)}: {stars(singleSide.foodRating, emDash)}</span>
                      <span>{t(T.FEEDBACK.RATING_SERVICE)}: {stars(singleSide.serviceRating, emDash)}</span>
                      <span>{t(T.FEEDBACK.RATING_VENUE)}: {stars(singleSide.venueRating, emDash)}</span>
                    </div>
                    {singleSide.comments && (
                      <p className={styles.comments}>"{singleSide.comments}"</p>
                    )}
                  </div>
                )}

                {dualSide && (
                <div className={styles.sidesGrid}>
                  {g.sides.map((side) => {
                    const sideKey = `${g.bookingId}-${side.clientSide}`;
                    const copyKey = `copy-${sideKey}`;
                    return (
                      <div
                        key={sideKey}
                        className={`${styles.sideCard} ${side.isCompleted ? styles.sideDone : styles.sidePending}`}
                      >
                        <div className={styles.sideHeader}>
                          <strong>{sideLabel(side.clientSide)}</strong>
                          <span>{side.clientName || emDash}</span>
                          <span className={side.isCompleted ? styles.statusDone : styles.statusPending}>
                            {side.isCompleted
                              ? t(T.FEEDBACK.STATUS_COMPLETED)
                              : side.lastNotifiedAt
                                ? t(T.FEEDBACK.STATUS_PENDING)
                                : t(T.FEEDBACK.STATUS_NOT_SENT)}
                          </span>
                        </div>
                        {side.isCompleted ? (
                          <>
                            <div className={styles.ratings}>
                              <span>{t(T.FEEDBACK.RATING_FOOD)}: {stars(side.foodRating, emDash)}</span>
                              <span>{t(T.FEEDBACK.RATING_SERVICE)}: {stars(side.serviceRating, emDash)}</span>
                              <span>{t(T.FEEDBACK.RATING_VENUE)}: {stars(side.venueRating, emDash)}</span>
                            </div>
                            <p className={styles.avg}>{t(T.FEEDBACK.AVERAGE)}: {side.averageScore?.toFixed(1)}</p>
                            {side.comments && (
                              <p className={styles.comments}>"{side.comments}"</p>
                            )}
                          </>
                        ) : (
                          <>
                            {side.lastNotifiedAt ? (
                              <div className={styles.sentStatus}>
                                <span className={styles.sentBadge}>{formatSentChannels(side)}</span>
                                <span className={styles.sentTime}>{formatSentTime(side.lastNotifiedAt)}</span>
                              </div>
                            ) : (
                              <p className={styles.waiting}>{t(T.FEEDBACK.STATUS_NOT_SENT)}</p>
                            )}
                            <div className={styles.sideActions}>
                              <button
                                type="button"
                                className={styles.copyBtn}
                                disabled={busyId === copyKey}
                                onClick={() =>
                                  handleCopyLink(g.bookingId, side.clientSide as 'A' | 'B')
                                }
                              >
                                {t(T.FEEDBACK.COPY_LINK)}
                              </button>
                              <button
                                type="button"
                                className={styles.sideSendBtn}
                                disabled={busyId === sideKey}
                                onClick={() =>
                                  handleSend(g.bookingId, side.clientSide as 'A' | 'B')
                                }
                              >
                                {sendLabel([side], busyId === sideKey)}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
                )}
              </article>
            );
            })}
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
