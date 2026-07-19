import React from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import styles from './PaginationBar.module.css';

interface PaginationBarProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}

export const PaginationBar: React.FC<PaginationBarProps> = ({
  page,
  totalPages,
  total,
  onPageChange,
}) => {
  const { t, T } = useTranslation();

  if (totalPages <= 1) return null;

  return (
    <div className={styles.bar}>
      <button
        type="button"
        className={styles.btn}
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        {t(T.COMMON.PAGINATION.PREVIOUS)}
      </button>
      <span className={styles.info}>
        {t(T.COMMON.PAGINATION.PAGE_INFO, { page, totalPages, total })}
      </span>
      <button
        type="button"
        className={styles.btn}
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        {t(T.COMMON.PAGINATION.NEXT)}
      </button>
    </div>
  );
};
