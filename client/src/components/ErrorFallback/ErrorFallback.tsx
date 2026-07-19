import React from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import styles from './ErrorFallback.module.css';

interface ErrorFallbackProps {
  error?: Error;
  resetError?: () => void;
}

export const ErrorFallback: React.FC<ErrorFallbackProps> = ({ error, resetError }) => {
  const { t, T } = useTranslation();
  return (
    <div className={styles.errorFallback}>
      <h1>{t(T.UI.ERROR_TITLE)}</h1>
      <p>{t(T.UI.ERROR_MESSAGE)}</p>
      {import.meta.env.DEV && error && (
        <pre>{error.message}</pre>
      )}
      {resetError && (
        <button type="button" onClick={resetError} className="maple-btn maple-btn-primary">
          {t(T.COMMON.ACTIONS.RETRY)}
        </button>
      )}
    </div>
  );
};
