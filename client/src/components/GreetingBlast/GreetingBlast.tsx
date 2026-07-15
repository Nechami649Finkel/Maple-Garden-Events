import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { API_URL } from '../../config/api';
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

const STATUS_LABELS: Record<GreetingStatus, string> = {
  PENDING: 'ממתין',
  PROCESSING: 'נשלח עכשיו',
  SENT: 'נשלח',
  FAILED: 'נכשל',
  CANCELLED: 'בוטל',
};

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const GreetingBlast = () => {
  const navigate = useNavigate();
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
        setResultMessage(result.message || 'הברכה נשלחה לכל הלקוחות');
        setSent(true);
        await refetchScheduledGreetings();
      } else {
        const detail = result.skippedReasons?.length
          ? `${result.message}\n\n${result.skippedReasons.join('\n')}`
          : result.message || 'שגיאה בשליחה';
        alert(detail);
      }
    } catch {
      alert('שגיאת תקשורת עם השרת');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!window.confirm('לבטל את הברכה המתוזמנת?')) return;
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
        alert(data.message || 'לא ניתן לבטל');
      }
    } catch {
      alert('שגיאת תקשורת עם השרת');
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
    if (item.sendStats.emailSent) parts.push(`${item.sendStats.emailSent} מיילים`);
    if (item.sendStats.whatsappSent) parts.push(`${item.sendStats.whatsappSent} וואטסאפ`);
    return parts.length ? parts.join(' · ') : null;
  };

  if (sent) {
    return (
      <div className={styles.container}>
        <div className={styles.successBox}>
          <div className={styles.successIcon}>✅</div>
          <h2>הברכה תישלח בהצלחה!</h2>
          <p>
            {scheduledDate && scheduledTime
              ? `מתוזמנת לשליחה בתאריך ${scheduledDate.split('-').reverse().join('/')} בשעה ${scheduledTime}. השליחה תתבצע אוטומטית — גם אם השרת יופעל מחדש.`
              : resultMessage || 'הברכה נשלחה לכל הלקוחות'}
          </p>
          <div className={styles.successActions}>
            {scheduledDate && scheduledTime && (
              <button type="button" className={styles.secondaryBtn} onClick={resetForm}>
                חזרה לרשימה
              </button>
            )}
            <button type="button" className={styles.backBtn} onClick={() => navigate('/calendar')}>
              חזרה ללוח
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
            <h2 className={styles.title}>שליחת ברכה ללקוחות 💌</h2>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>תזמון שליחה</h3>
              <div className={styles.row}>
                <div className={styles.inputGroup}>
                  <label>תאריך שליחה</label>
                  <input
                    type="date"
                    className={styles.input}
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label>שעת שליחה</label>
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
                  ? `📅 תישלח בתאריך ${scheduledDate.split('-').reverse().join('/')} בשעה ${scheduledTime}`
                  : 'אם לא תבחרי תאריך ושעה - הברכה תישלח מיד'}
              </p>
            </div>

            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>תוכן הברכה</h3>
              <div className={styles.inputGroup}>
                <label>נושא המייל *</label>
                <input
                  type="text"
                  required
                  className={styles.input}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="לדוגמה: ברכות לחג הפסח מגן אירועים מייפל 🌸"
                />
              </div>
              <div className={styles.inputGroup}>
                <label>תוכן הברכה *</label>
                <textarea
                  required
                  className={styles.textarea}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={6}
                  placeholder="כתבי כאן את תוכן הברכה שתישלח לכל הלקוחות..."
                />
              </div>
            </div>

            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>קובץ מצורף (אופציונלי)</h3>
              <div className={styles.fileArea}>
                <input
                  type="file"
                  id="fileInput"
                  accept="image/*,.pdf,.doc,.docx"
                  style={{ display: 'none' }}
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <label htmlFor="fileInput" className={styles.fileLabel}>
                  {file ? `📎 ${file.name}` : '+ לחצי להוספת קובץ (תמונה / PDF / Word)'}
                </label>
                {file && (
                  <button type="button" className={styles.removeFile} onClick={() => setFile(null)}>
                    ✕ הסר קובץ
                  </button>
                )}
              </div>
            </div>

            <div className={styles.footer}>
              <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                {isSubmitting
                  ? 'שולח...'
                  : scheduledDate && scheduledTime
                    ? '📅 תזמן שליחה'
                    : '📨 שלח עכשיו לכל הלקוחות'}
              </button>
            </div>
          </form>
        </div>

        <div className={styles.listCard}>
          <div className={styles.listHeader}>
            <h2 className={styles.listTitle}>ברכות מתוזמנות</h2>
            <button type="button" className={styles.refreshBtn} onClick={() => refetchScheduledGreetings()}>
              רענון
            </button>
          </div>

          <div className={styles.filterRow}>
            {([
              ['ALL', 'הכל'],
              ['PENDING', 'ממתינות'],
              ['SENT', 'נשלחו'],
              ['FAILED', 'נכשלו'],
            ] as const).map(([key, label]) => (
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
            <p className={styles.listEmpty}>טוען...</p>
          ) : filteredItems.length === 0 ? (
            <p className={styles.listEmpty}>אין ברכות מתוזמנות להצגה.</p>
          ) : (
            <ul className={styles.list}>
              {filteredItems.map((item) => (
                <li key={item.id} className={styles.listItem}>
                  <div className={styles.listItemTop}>
                    <strong className={styles.listSubject}>{item.subject}</strong>
                    <span className={`${styles.statusBadge} ${styles[`status_${item.status}`]}`}>
                      {STATUS_LABELS[item.status]}
                    </span>
                  </div>
                  <p className={styles.listMessage}>{item.message}</p>
                  <div className={styles.listMeta}>
                    <span>📅 {formatDateTime(item.scheduledAt)}</span>
                    {item.attachmentName && <span>📎 {item.attachmentName}</span>}
                    {item.sentAt && <span>✅ נשלח: {formatDateTime(item.sentAt)}</span>}
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
                      {cancellingId === item.id ? 'מבטל...' : 'ביטול תזמון'}
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
