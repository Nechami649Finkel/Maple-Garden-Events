import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import styles from './FeedbackPage.module.css';

// --- הגדרות טיפוסים (TypeScript Interfaces) ---

interface ClientData {
  clientName: string;
  clientSide: string;
}

interface Ratings {
  food: number;
  service: number;
  venue: number;
}

type PageStatus = 'loading' | 'active' | 'submitted' | 'error';

// --- קומפוננטת עזר לדירוג כוכבים ---
// שומרת על הקוד הראשי נקי ומונעת שכפול של לוגיקת הכוכבים 3 פעמים
const StarRating: React.FC<{
  label: string;
  value: number;
  onChange: (value: number) => void;
}> = ({ label, value, onChange }) => {
  return (
    <div className={styles.ratingRow}>
      <span className={styles.ratingLabel}>{label}</span>
      <div className={styles.stars}>
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            className={`${styles.star} ${star <= value ? styles.starActive : ''}`}
            onClick={() => onChange(star)}
            role="button"
            aria-label={`דרג ${star} כוכבים`}
          >
            ★
          </span>
        ))}
      </div>
    </div>
  );
};

// --- הקומפוננטה הראשית ---

const FeedbackPage: React.FC = () => {
  // חילוץ האסימון מהנתיב (למשל: /feedback/abc-123-def)
  const { token } = useParams<{ token: string }>();

  // ניהול מצבי הדף
  const [status, setStatus] = useState<PageStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [clientData, setClientData] = useState<ClientData | null>(null);

  // ניהול הטופס
  const [ratings, setRatings] = useState<Ratings>({ food: 0, service: 0, venue: 0 });
  const [comments, setComments] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  // 1. קריאת GET: בדיקת תקינות הקישור בטעינה הראשונית
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setStatus('error');
        setErrorMessage('קישור חסר או לא תקין.');
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/feedback/${token}`);
        const data = await response.json();

        if (response.ok && data.success) {
          setClientData({
            clientName: data.clientName,
            clientSide: data.clientSide,
          });
          setStatus('active');
        } else {
          setStatus('error');
          setErrorMessage(data.message || 'הקישור אינו חוקי או שכבר מולא.');
        }
      } catch (error) {
        console.error('Error verifying token:', error);
        setStatus('error');
        setErrorMessage('אירעה שגיאה בתקשורת עם השרת. אנא נסה שוב מאוחר יותר.');
      }
    };

    verifyToken();
  }, [token, API_BASE_URL]);

  // 2. קריאת POST: שליחת המשוב לשרת
  const handleSubmit = async () => {
    // ולידציה בסיסית - לוודא שהלקוח דירג לפחות משהו אחד או מילא הכל
    if (ratings.food === 0 || ratings.service === 0 || ratings.venue === 0) {
      alert('נשמח אם תדרגו את כל הקטגוריות כדי שנוכל להשתפר!');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/feedback/${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          foodRating: ratings.food,
          serviceRating: ratings.service,
          venueRating: ratings.venue,
          comments,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setStatus('submitted');
      } else {
        alert(data.message || 'אירעה שגיאה בשמירת המשוב.');
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert('שגיאת תקשורת. אנא בדוק את החיבור לאינטרנט ונסה שוב.');
      setIsSubmitting(false);
    }
  };

  // --- פונקציות רינדור (Rendering) לפי מצב ---

  if (status === 'loading') {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <h2 className={styles.title}>טוען נתונים...</h2>
          <p className={styles.subtitle}>אנא המתן</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={styles.container}>
        <div className={`${styles.card} ${styles.messageBox}`}>
          <div className={styles.iconBig}>😕</div>
          <h2 className={styles.title}>אופס!</h2>
          <p className={styles.subtitle}>{errorMessage}</p>
        </div>
      </div>
    );
  }

  if (status === 'submitted') {
    return (
      <div className={styles.container}>
        <div className={`${styles.card} ${styles.messageBox}`}>
          <div className={styles.iconBig}>🤍</div>
          <h2 className={styles.title}>תודה רבה!</h2>
          <p className={styles.subtitle}>
            המשוב שלך התקבל בהצלחה. אנו מעריכים מאוד את הזמן שהקדשת כדי לעזור לנו להשתפר!
          </p>
        </div>
      </div>
    );
  }

  // המצב הרגיל - טופס המשוב
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>
          היי {clientData?.clientName},
        </h1>
        <p className={styles.subtitle}>
          שמחנו לקחת חלק באירוע שלכם! נשמח לשמוע איך היה כדי שנוכל להמשיך להשתפר.
        </p>

        <div className={styles.ratingSection}>
          <StarRating
            label="איך היה האוכל?"
            value={ratings.food}
            onChange={(val) => setRatings({ ...ratings, food: val })}
          />
          <StarRating
            label="איך היה השירות?"
            value={ratings.service}
            onChange={(val) => setRatings({ ...ratings, service: val })}
          />
          <StarRating
            label="נראות וניקיון האולם"
            value={ratings.venue}
            onChange={(val) => setRatings({ ...ratings, venue: val })}
          />
        </div>

        <textarea
          className={styles.textArea}
          placeholder="נשמח לשמוע פירוט, הערות או הארות נוספות (אופציונלי)..."
          value={comments}
          onChange={(e) => setComments(e.target.value)}
        />

        <button
          className={styles.submitBtn}
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'שולח...' : 'שליחת משוב'}
        </button>
      </div>
    </div>
  );
};

export default FeedbackPage;