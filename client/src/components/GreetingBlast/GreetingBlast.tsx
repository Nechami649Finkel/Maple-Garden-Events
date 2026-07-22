import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatDateTime } from '@shared/i18n/formatters';
import { API_URL } from '../../config/api';
import { useTranslation } from '../../i18n/useTranslation';
import { secureFetch } from '../../services/api';
import styles from './GreetingBlast.module.css';

type GreetingStatus = 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'CANCELLED';

type ScheduledGreetingItem = {
  id: string;
  subject: string;
  message: string;
  scheduledAt: string;
  attachmentName: string | null;
  status: GreetingStatus;
  sentAt: string | null;
  sendStats: {
    emailSent?: number;
    whatsappSent?: number;
  } | null;
  errorMessage: string | null;
  createdBy: string | null;
  createdAt: string;
};

type StatusFilter = 'ALL' | 'PENDING' | 'SENT' | 'FAILED';

const GreetingBlast = () => {
  const navigate = useNavigate();
  const { t, T, locale } = useTranslation();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [resultMessage, setResultMessage] = useState('');
  const {
    data: scheduledItems = [],
    isLoading: listLoading,
    refetch: refetchScheduledGreetings,
  } = useQuery({
    queryKey: ['scheduled-greetings'],
    queryFn: async (): Promise<ScheduledGreetingItem[]> => {
      const res = await secureFetch(`${API_URL}/bookings/scheduled-greetings`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        return data.items || [];
      }
      return [];
    },
    refetchInterval: (query) => {
      const items = query.state.data ?? [];
      return items.some((item) => item.status === 'PENDING' || item.status === 'PROCESSING')
        ? 30_000
        : false;
    },
  });

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const statusLabels = useMemo<Record<GreetingStatus, string>>(
    () => ({
      PENDING: t(T.GREETING.STATUS_PENDING),
      PROCESSING: t(T.GREETING.STATUS_PROCESSING),
      SENT: t(T.GREETING.STATUS_SENT),
      FAILED: t(T.GREETING.STATUS_FAILED),
      CANCELLED: t(T.GREETING.STATUS_CANCELLED),
    }),
    [t, T],
  );

  const filterOptions = useMemo(
    () =>
      [
        ['ALL', t(T.FEEDBACK.FILTER_ALL)],
        ['PENDING', t(T.GREETING.STATUS_PENDING)],
        ['SENT', t(T.GREETING.STATUS_SENT)],
        ['FAILED', t(T.GREETING.STATUS_FAILED)],
      ] as const,
    [t, T],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('subject', subject);
      formData.append('message', message);
      formData.append('scheduledDate', scheduledDate);
      formData.append('scheduledTime', scheduledTime);
      if (file) formData.append('attachment', file);

      const res = await secureFetch(`${API_URL}/bookings/send-greeting`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const result = await res.json();
      if (result.success) {
        setResultMessage(result.message || t(T.GREETING.SENT_TO_ALL));
        setSent(true);
        await refetchScheduledGreetings();
      } else {
        const detail = result.skippedReasons?.length
          ? `${result.message}\n\n${result.skippedReasons.join('\n')}`
          : result.message || t(T.GREETING.SEND_ERROR);
        alert(detail);
      }
    } catch {
      alert(t(T.GREETING.SERVER_ERROR));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!window.confirm(t(T.GREETING.CANCEL_CONFIRM))) return;
    setCancellingId(id);
    try {
      const res = await secureFetch(`${API_URL}/bookings/scheduled-greetings/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        await refetchScheduledGreetings();
      } else {
        alert(data.message || t(T.GREETING.CANCEL_ERROR));
      }
    } catch {
      alert(t(T.GREETING.SERVER_ERROR));
    } finally {
      setCancellingId(null);
    }
  };

  const resetForm = () => {
    setSent(false);
    setSubject('');
    setMessage('');
    setScheduledDate('');
    setScheduledTime('');
    setFile(null);
    setResultMessage('');
  };

  const filteredItems = scheduledItems.filter((item) => {
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'PENDING') return item.status === 'PENDING' || item.status === 'PROCESSING';
    return item.status === statusFilter;
  });

  const renderStats = (item: ScheduledGreetingItem) => {
    if (item.status !== 'SENT' || !item.sendStats) return null;
    const parts: string[] = [];
    if (item.sendStats.emailSent) {
      parts.push(t(T.GREETING.STAT_EMAILS, { count: item.sendStats.emailSent }));
    }
    if (item.sendStats.whatsappSent) {
      parts.push(t(T.GREETING.STAT_WHATSAPP, { count: item.sendStats.whatsappSent }));
    }
    return parts.length ? parts.join(' · ') : null;
  };

  if (sent) {
    return (
      <div className={styles.container}>
        <div className={styles.successBox}>
          <div className={styles.successIcon}>✅</div>
          <h2>{t(T.GREETING.SUCCESS_TITLE)}</h2>
          <p>
            {scheduledDate && scheduledTime
              ? t(T.GREETING.SCHEDULED_MESSAGE)
              : resultMessage || t(T.GREETING.SENT_TO_ALL)}
          </p>
          <div className={styles.successActions}>
            {scheduledDate && scheduledTime && (
              <button type="button" className={styles.secondaryBtn} onClick={resetForm}>
                {t(T.GREETING.BACK_TO_LIST)}
              </button>
            )}
            <button type="button" className={styles.backBtn} onClick={() => navigate('/calendar')}>
              {t(T.GREETING.BACK_TO_DASHBOARD)}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.layout}>
        <div className={styles.card}>
          <div className={styles.header}>
            <h2 className={styles.title}>{t(T.GREETING.PAGE_TITLE)}</h2>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>{t(T.GREETING.SECTION_SCHEDULE)}</h3>
              <div className={styles.row}>
                <div className={styles.inputGroup}>
                  <label>{t(T.GREETING.LABEL_SEND_DATE)}</label>
                  <input
                    type="date"
                    className={styles.input}
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label>{t(T.GREETING.LABEL_SEND_TIME)}</label>
                  <input
                    type="time"
                    className={styles.input}
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                  />
                </div>
              </div>
              <p className={styles.hint}>
                {scheduledDate && scheduledTime
                  ? t(T.GREETING.SCHEDULE_HINT)
                  : t(T.GREETING.SEND_NOW_HINT)}
              </p>
            </div>

            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>{t(T.GREETING.SECTION_CONTENT)}</h3>
              <div className={styles.inputGroup}>
                <label>{t(T.GREETING.LABEL_SUBJECT)} *</label>
                <input
                  type="text"
                  required
                  className={styles.input}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={t(T.GREETING.SUBJECT_PLACEHOLDER)}
                />
              </div>
              <div className={styles.inputGroup}>
                <label>{t(T.GREETING.LABEL_BODY)} *</label>
                <textarea
                  required
                  className={styles.textarea}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={6}
                  placeholder={t(T.GREETING.BODY_PLACEHOLDER)}
                />
              </div>
            </div>

            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>{t(T.GREETING.SECTION_ATTACHMENT)}</h3>
              <div className={styles.fileArea}>
                <input
                  type="file"
                  id="fileInput"
                  accept="image/*,.pdf,.doc,.docx"
                  style={{ display: 'none' }}
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <label htmlFor="fileInput" className={styles.fileLabel}>
                  {file ? `📎 ${file.name}` : `+ ${t(T.GREETING.ADD_FILE)}`}
                </label>
                {file && (
                  <button type="button" className={styles.removeFile} onClick={() => setFile(null)}>
                    ✕ {t(T.GREETING.REMOVE_FILE)}
                  </button>
                )}
              </div>
            </div>

            <div className={styles.footer}>
              <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                {isSubmitting
                  ? t(T.GREETING.SENDING)
                  : scheduledDate && scheduledTime
                    ? t(T.GREETING.SUBMIT_SCHEDULE)
                    : t(T.GREETING.SUBMIT_NOW)}
              </button>
            </div>
          </form>
        </div>

        <div className={styles.listCard}>
          <div className={styles.listHeader}>
            <h2 className={styles.listTitle}>{t(T.GREETING.SCHEDULED_TITLE)}</h2>
            <button type="button" className={styles.refreshBtn} onClick={() => refetchScheduledGreetings()}>
              {t(T.GREETING.REFRESH)}
            </button>
          </div>

          <div className={styles.filterRow}>
            {filterOptions.map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`${styles.filterBtn} ${statusFilter === key ? styles.filterBtnActive : ''}`}
                onClick={() => setStatusFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {listLoading ? (
            <p className={styles.listEmpty}>{t(T.GREETING.LIST_LOADING)}</p>
          ) : filteredItems.length === 0 ? (
            <p className={styles.listEmpty}>{t(T.GREETING.LIST_EMPTY)}</p>
          ) : (
            <ul className={styles.list}>
              {filteredItems.map((item) => (
                <li key={item.id} className={styles.listItem}>
                  <div className={styles.listItemTop}>
                    <strong className={styles.listSubject}>{item.subject}</strong>
                    <span className={`${styles.statusBadge} ${styles[`status_${item.status}`]}`}>
                      {statusLabels[item.status]}
                    </span>
                  </div>
                  <p className={styles.listMessage}>{item.message}</p>
                  <div className={styles.listMeta}>
                    <span>📅 {formatDateTime(item.scheduledAt, locale)}</span>
                    {item.attachmentName && <span>📎 {item.attachmentName}</span>}
                    {item.sentAt && (
                      <span>
                        ✅ {t(T.GREETING.SENT_AT)} {formatDateTime(item.sentAt, locale)}
                      </span>
                    )}
                    {renderStats(item) && <span>{renderStats(item)}</span>}
                    {item.createdBy && <span>👤 {item.createdBy}</span>}
                  </div>
                  {item.errorMessage && item.status === 'FAILED' && (
                    <p className={styles.listError}>{item.errorMessage}</p>
                  )}
                  {item.status === 'PENDING' && (
                    <button
                      type="button"
                      className={styles.cancelBtn}
                      disabled={cancellingId === item.id}
                      onClick={() => handleCancel(item.id)}
                    >
                      {cancellingId === item.id
                        ? t(T.GREETING.CANCELLING)
                        : t(T.GREETING.CANCEL_SCHEDULE)}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default GreetingBlast;
