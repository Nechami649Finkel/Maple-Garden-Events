import React from 'react';
import styles from './PageLoader.module.css';

export const PageLoader: React.FC = () => (
  <div className={styles.wrapper}>
    <div className={styles.spinner} />
    <span>טוען...</span>
  </div>
);
