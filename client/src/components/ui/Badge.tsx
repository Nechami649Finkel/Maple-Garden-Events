import styles from './Badge.module.css';

export type BadgeVariant = 'confirmed' | 'option' | 'past' | 'live' | 'neutral' | 'gold';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = 'neutral', className = '' }: BadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[variant]} ${className}`}>
      {children}
    </span>
  );
}
