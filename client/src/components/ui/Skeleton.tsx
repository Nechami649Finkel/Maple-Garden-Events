import { useTranslation } from '../../i18n/useTranslation';
import styles from './Skeleton.module.css';

interface SkeletonProps {
  width?: string;
  height?: string;
  className?: string;
}

export function Skeleton({ width = '100%', height = '1rem', className = '' }: SkeletonProps) {
  const { t, T } = useTranslation();

  return (
    <div
      className={`${styles.skeleton} ${className}`}
      style={{ width, height }}
      role="status"
      aria-busy="true"
      aria-label={t(T.UI.LOADING)}
    />
  );
}

export function SkeletonGroup({ rows = 3 }: { rows?: number }) {
  const { t, T } = useTranslation();

  return (
    <div className={styles.group} role="status" aria-busy="true" aria-label={t(T.UI.LOADING)}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height="2.5rem" />
      ))}
    </div>
  );
}
