import React, { useState, useEffect } from 'react';
import styles from './CancellationStats.module.css';

interface Stat {
  reason: string;
  count: number;
}

const CancellationStats = () => {
  const [stats, setStats] = useState<Stat[]>([]);
  const [loading, setLoading] = useState(false);
  
  // ברירת מחדל: השנה הנוכחית, וכל השנה (חודש ריק)
  const [year, setYear] = useState<string>(new Date().getFullYear().toString());
  const [month, setMonth] = useState<string>('');

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

  // יצירת רשימת שנים (מהשנה הנוכחית ועד 3 שנים אחורה וקדימה)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => (currentYear - 2 + i).toString());

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        let url = `http://localhost:5000/api/bookings/stats/cancellations?year=${year}`;
        if (month) url += `&month=${month}`;
        
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.success) {
          setStats(data.data);
        }
      } catch (error) {
        console.error("Failed to fetch cancellation stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [year, month]);

  // חישובים לתצוגת הגרף (מציאת המספר הגבוה ביותר כדי לחשב אחוזים)
  const maxCount = stats.length > 0 ? Math.max(...stats.map(s => s.count)) : 0;
  const totalCancellations = stats.reduce((sum, s) => sum + s.count, 0);

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
            {stats.map((stat, index) => {
              // חישוב רוחב העמודה באחוזים (יחסית לסיבה הכי נפוצה)
              const percentage = maxCount > 0 ? (stat.count / maxCount) * 100 : 0;
              
              // חישוב אחוז מסך כל הביטולים להצגה בטקסט
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