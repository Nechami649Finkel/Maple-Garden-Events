import React from 'react';
import styles from './Card.module.css';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
  compact?: boolean;
}

export const Card = ({ children, className = '', interactive = false, compact = false }: CardProps) => (
  <div
    className={`${styles.card} ${interactive ? styles.interactive : ''} ${compact ? styles.compact : ''} ${className}`}
  >
    {children}
  </div>
);

interface CardHeaderProps {
  title: string;
  children?: React.ReactNode;
}

export const CardHeader = ({ title, children }: CardHeaderProps) => (
  <div className={styles.header}>
    <h3 className={styles.headerTitle}>{title}</h3>
    {children}
  </div>
);

export const CardBody = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`${styles.body} ${className}`}>{children}</div>
);

export const CardFooter = ({ children }: { children: React.ReactNode }) => (
  <div className={styles.footer}>{children}</div>
);
