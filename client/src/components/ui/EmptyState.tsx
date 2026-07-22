import React from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import styles from './EmptyState.module.css';

interface EmptyStateProps {
  icon?: string;
  title?: string;
  message?: string;
  action?: React.ReactNode;
}

export const EmptyState = ({
  icon = '📭',
  title,
  message,
  action,
}: EmptyStateProps) => {
  const { t, T } = useTranslation();
  const resolvedTitle = title ?? t(T.UI.EMPTY_STATE_TITLE);
  const resolvedMessage = message ?? t(T.UI.EMPTY_STATE_MESSAGE);

  return (
    <div className={styles.empty}>
      <div className={styles.icon} aria-hidden="true">
        {icon}
      </div>
      <h3 className={styles.title}>{resolvedTitle}</h3>
      <p className={styles.message}>{resolvedMessage}</p>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
};
