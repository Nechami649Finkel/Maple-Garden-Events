import { useState } from 'react';
import styles from './CancellationStats.module.css';
import { useCancellationStatsQuery } from '../../hooks/queries';

interface Stat {
  reason: string;
  count: number;
}

const CancellationStats = () => {
  const [year, setYear] = useState<string>(new Date().getFullYear().toString());
  const [month, setMonth] = useState<string>('');

  const { data: stats = [], isLoading: loading } = useCancellationStatsQuery(year, month);

  const months = [
    { value: '', label: 'כל השנה (סיכום שנתי)' },
    { value: '1', label: 'ינואר' },
    { value: '2', label: 'פברואר' },
    { value: '3', label: 'מרץ' },
    { value: '4', label: 'אפריל' },
    { value: '5', label: 'מאי' },
    { value: '6', label: 'יוני' },
    { value: '7', label: 'יולי' },
    { value: '8', label: 'אוגוסט' },
    { value: '9', label: 'ספטמבר' },
    { value: '10', label: 'אוקטובר' },
    { value: '11', label: 'נובמבר' },
    { value: '12', label: 'דצמבר' },
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => (currentYear - 2 + i).toString());

  const maxCount = stats.length > 0 ? Math.max(...stats.map((s: Stat) => s.count)) : 0;
  const totalCancellations = stats.reduce((sum: number, s: Stat) => sum + s.count, 0);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          📉 סטטיסטיקת ביטולי אופציות
        </h2>
        <div className={styles.filters}>
          <select
            className={styles.select}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          >
            {months.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <select
            className={styles.select}
            value={year}
            onChange={(e) => setYear(e.target.value)}
          >
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>טוען נתונים... ⏳</div>
      ) : stats.length === 0 ? (
        <div className={styles.noData}>
          אין נתוני ביטולים לתקופה זו. איזה יופי! 🎉
        </div>
      ) : (
        <>
          <div className={styles.totalSummary}>
            סה"כ תאריכים שבוטלו / שוחררו בתקופה זו: {totalCancellations}
          </div>

          <div className={styles.statsList}>
            {stats.map((stat: Stat, index: number) => {
              const percentage = maxCount > 0 ? (stat.count / maxCount) * 100 : 0;
              const totalPercentage = ((stat.count / totalCancellations) * 100).toFixed(1);

              return (
                <div key={index} className={styles.statItem}>
                  <div className={styles.statHeader}>
                    <span>{stat.reason}</span>
                    <span>{stat.count} ביטולים ({totalPercentage}%)</span>
                  </div>
                  <div className={styles.barContainer}>
                    <div
                      className={styles.barFill}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default CancellationStats;
