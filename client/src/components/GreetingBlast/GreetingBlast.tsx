import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './GreetingBlast.module.css';

const GreetingBlast = () => {
  const navigate = useNavigate();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

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

      const res = await fetch('http://localhost:5000/api/bookings/send-greeting', {
        method: 'POST',
        body: formData,
      });

      const result = await res.json();
      if (result.success) {
        setSent(true);
      } else {
        alert(result.message || 'שגיאה בשליחה');
      }
    } catch {
      alert('שגיאת תקשורת עם השרת');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className={styles.container}>
        <div className={styles.successBox}>
          <div className={styles.successIcon}>✅</div>
          <h2>הברכה תישלח בהצלחה!</h2>
          <p>
            {scheduledDate && scheduledTime
              ? `מתוזמנת לשליחה בתאריך ${scheduledDate.split('-').reverse().join('/')} בשעה ${scheduledTime}`
              : 'הברכה נשלחה לכל הלקוחות'}
          </p>
          <button className={styles.backBtn} onClick={() => navigate('/')}>חזרה ללוח</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <button onClick={() => navigate('/')} className={styles.backBtn}>← חזרה ללוח</button>
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
                  onChange={e => setScheduledDate(e.target.value)}
                />
              </div>
              <div className={styles.inputGroup}>
                <label>שעת שליחה</label>
                <input
                  type="time"
                  className={styles.input}
                  value={scheduledTime}
                  onChange={e => setScheduledTime(e.target.value)}
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
                onChange={e => setSubject(e.target.value)}
                placeholder="לדוגמה: ברכות לחג הפסח מגן אירועים מייפל 🌸"
              />
            </div>
            <div className={styles.inputGroup}>
              <label>תוכן הברכה *</label>
              <textarea
                required
                className={styles.textarea}
                value={message}
                onChange={e => setMessage(e.target.value)}
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
                onChange={e => setFile(e.target.files?.[0] || null)}
              />
              <label htmlFor="fileInput" className={styles.fileLabel}>
                {file ? `📎 ${file.name}` : '+ לחצי להוספת קובץ (תמונה / PDF / Word)'}
              </label>
              {file && (
                <button type="button" className={styles.removeFile} onClick={() => setFile(null)}>✕ הסר קובץ</button>
              )}
            </div>
          </div>

          <div className={styles.footer}>
            <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
              {isSubmitting ? 'שולח...' : scheduledDate && scheduledTime ? '📅 תזמן שליחה' : '📨 שלח עכשיו לכל הלקוחות'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default GreetingBlast;
