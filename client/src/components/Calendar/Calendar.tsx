import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';

const socket = io("http://localhost:5000");

interface CalendarProps {
  onDateSelect: (date: any) => void;
}

export const Calendar = ({ onDateSelect }: CalendarProps) => {
  const [dates, setDates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true); // נוסיף מצב טעינה

  useEffect(() => {
    const fetchDates = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/calendar/dates', {
          params: { start: '2026-06-01', end: '2026-06-30' }
        });
        setDates(response.data);
        setLoading(false);
      } catch (err) {
        console.error("שגיאה במשיכת תאריכים:", err);
        setLoading(false); // גם אם יש שגיאה, נפסיק את הטעינה
      }
    };

    fetchDates();

    socket.on("date-updated", (updatedDate) => {
      setDates(prev => prev.map(d => d.id === updatedDate.id ? updatedDate : d));
    });

    return () => { socket.off("date-updated"); };
  }, []);

  if (loading) return <div>טוען את היומן...</div>;

  return (
    <div className="calendar-grid">
      {dates.length > 0 ? (
        dates.map((d) => (
          <div key={d.id} onClick={() => onDateSelect(d)} style={{ cursor: 'pointer', border: '1px solid black', margin: '5px' }}>
            {d.hebrewDate || 'תאריך חסר'} - {d.status || 'סטטוס לא ידוע'}
          </div>
        ))
      ) : (
        <div>אין תאריכים להצגה</div>
      )}
    </div>
  );
};

// export const Calendar = ({ onDateSelect }: CalendarProps) => {
//   const [dates, setDates] = useState<any[]>([]);

//   // 1. משיכת הנתונים מהשרת
//   const fetchDates = async () => {
//     try {
//       const response = await axios.get('http://localhost:5000/api/calendar/dates', {
//         params: { start: '2026-06-01', end: '2026-06-30' }
//       });
//       setDates(response.data);
//     } catch (err) {
//       console.error("שגיאה במשיכת תאריכים:", err);
//     }
//   };

//   useEffect(() => {
//     fetchDates();

//     // 2. האזנה לעדכונים בזמן אמת
//     socket.on("date-updated", (updatedDate) => {
//       setDates(prevDates => 
//         prevDates.map(d => d.id === updatedDate.id ? updatedDate : d)
//       );
//     });

//     return () => { socket.off("date-updated"); };
//   }, []);

//   return (
//     <div className="calendar-grid">
//       {dates.map((d) => (
//         <div 
//           key={d.id} 
//           // הוספנו כאן לחיצה שמעדכנת את ההורה (App.tsx)
//           onClick={() => onDateSelect(d)}
//           className={`cell ${d.statusInfo?.type || 'available'}`}
//           style={{ cursor: 'pointer', border: '1px solid #ccc', padding: '10px' }}
//         >
//           <div>{d.hebrewDate}</div>
//           <div>{d.status}</div>
//         </div>
//       ))}
//     </div>
//   );
// };