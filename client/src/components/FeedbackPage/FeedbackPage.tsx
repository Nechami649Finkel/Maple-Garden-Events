import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import styles from './FeedbackPage.module.css';
import { API_URL } from '../../config/api';
import { useTranslation } from '../../i18n/useTranslation';

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

const StarRating: React.FC<{
  label: string;
  value: number;
  onChange: (value: number) => void;
  starAriaLabel: (star: number) => string;
}> = ({ label, value, onChange, starAriaLabel }) => {
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
            aria-label={starAriaLabel(star)}
          >
            ★
          </span>
        ))}
      </div>
    </div>
  );
};

const FeedbackPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const { t, T } = useTranslation();

  const [status, setStatus] = useState<PageStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [clientData, setClientData] = useState<ClientData | null>(null);

  const [ratings, setRatings] = useState<Ratings>({ food: 0, service: 0, venue: 0 });
  const [comments, setComments] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const feedbackApiBase = `${API_URL}/feedback`;

  const starAriaLabel = (star: number) => t(T.FEEDBACK.RATE_STAR_ARIA, { value: star });

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setStatus('error');
        setErrorMessage(t(T.FEEDBACK.INVALID_LINK));
        return;
      }

      try {
        const response = await fetch(`${feedbackApiBase}/${token}`);
        const data = await response.json();

        if (response.ok && data.success) {
          setClientData({
            clientName: data.clientName,
            clientSide: data.clientSide,
          });
          setStatus('active');
        } else {
          setStatus('error');
          setErrorMessage(data.message || t(T.FEEDBACK.LINK_USED));
        }
      } catch (error) {
        console.error('Error verifying token:', error);
        setStatus('error');
        setErrorMessage(t(T.FEEDBACK.LOAD_ERROR_PUBLIC));
      }
    };

    verifyToken();
  }, [token, feedbackApiBase, t, T]);

  const handleSubmit = async () => {
    if (ratings.food === 0 || ratings.service === 0 || ratings.venue === 0) {
      alert(t(T.FEEDBACK.RATE_ALL_PROMPT));
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${feedbackApiBase}/${token}`, {
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
        alert(data.message || t(T.FEEDBACK.SAVE_ERROR));
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert(t(T.FEEDBACK.NETWORK_ERROR));
      setIsSubmitting(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <img src="/logo.png" alt={t(T.UI.BRAND_ALT)} className={styles.logo} />
          <h2 className={styles.title}>{t(T.FEEDBACK.LOADING_TITLE)}</h2>
          <p className={styles.subtitle}>{t(T.FEEDBACK.LOADING_SUBTITLE)}</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={styles.container}>
        <div className={`${styles.card} ${styles.messageBox}`}>
          <img src="/logo.png" alt={t(T.UI.BRAND_ALT)} className={styles.logo} />
          <div className={styles.iconBig}>😕</div>
          <h2 className={styles.title}>{t(T.FEEDBACK.ERROR_TITLE)}</h2>
          <p className={styles.subtitle}>{errorMessage}</p>
        </div>
      </div>
    );
  }

  if (status === 'submitted') {
    return (
      <div className={styles.container}>
        <div className={`${styles.card} ${styles.messageBox}`}>
          <img src="/logo.png" alt={t(T.UI.BRAND_ALT)} className={styles.logo} />
          <div className={styles.iconBig}>🤍</div>
          <h2 className={styles.title}>{t(T.FEEDBACK.THANK_YOU_TITLE)}</h2>
          <p className={styles.subtitle}>{t(T.FEEDBACK.THANK_YOU_MESSAGE)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <img src="/logo.png" alt={t(T.UI.BRAND_ALT)} className={styles.logo} />
        <h1 className={styles.title}>{t(T.FEEDBACK.PAGE_GREETING)}</h1>
        <p className={styles.subtitle}>
          {clientData?.clientName ? `${clientData.clientName}, ` : ''}
          {t(T.FEEDBACK.PAGE_INTRO)}
        </p>

        <div className={styles.ratingSection}>
          <StarRating
            label={t(T.FEEDBACK.RATE_FOOD)}
            value={ratings.food}
            onChange={(val) => setRatings({ ...ratings, food: val })}
            starAriaLabel={starAriaLabel}
          />
          <StarRating
            label={t(T.FEEDBACK.RATE_SERVICE)}
            value={ratings.service}
            onChange={(val) => setRatings({ ...ratings, service: val })}
            starAriaLabel={starAriaLabel}
          />
          <StarRating
            label={t(T.FEEDBACK.RATE_VENUE)}
            value={ratings.venue}
            onChange={(val) => setRatings({ ...ratings, venue: val })}
            starAriaLabel={starAriaLabel}
          />
        </div>

        <textarea
          className={styles.textArea}
          placeholder={t(T.FEEDBACK.COMMENTS_PLACEHOLDER)}
          value={comments}
          onChange={(e) => setComments(e.target.value)}
        />

        <button
          className={styles.submitBtn}
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? t(T.FEEDBACK.SUBMITTING) : t(T.FEEDBACK.SUBMIT)}
        </button>
      </div>
    </div>
  );
};

export default FeedbackPage;
