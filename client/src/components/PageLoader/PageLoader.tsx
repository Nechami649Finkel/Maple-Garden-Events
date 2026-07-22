import React from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import styles from './PageLoader.module.css';

export const PageLoader: React.FC = () => {
  const { t, T } = useTranslation();
  return (
    <div className={styles.wrapper}>
      <div className={styles.spinner} />
      <span>{t(T.COMMON.LABELS.LOADING)}</span>
    </div>
  );
};
