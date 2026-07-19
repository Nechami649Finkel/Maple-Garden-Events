import { useTranslation } from '../../i18n/useTranslation';
import styles from './SectionHeader.module.css';

interface SectionHeaderProps {
  title: string;
  count?: number;
  action?: React.ReactNode;
  as?: 'h2' | 'h3';
}

export function SectionHeader({ title, count, action, as: Tag = 'h2' }: SectionHeaderProps) {
  const { t, T } = useTranslation();

  return (
    <div className={styles.wrap}>
      <Tag className={styles.title}>
        {title}
        {count !== undefined && (
          <span className={styles.count} aria-label={t(T.UI.SECTION_ITEMS, { count })}>
            {count}
          </span>
        )}
      </Tag>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
