// client/src/App.tsx
import React, { useState, useEffect } from 'react';
import BookingForm from './components/BookingForm/BookingForm';
import { Calendar } from './components/Calendar/Calendar';
import './App.css';

function App() {
  const [selectedDateData, setSelectedDateData] = useState<any>(null);

  const handleDateSelect = (dateData: any) => {
    console.log("התאריך שנבחר בלוח השנה:", dateData);
    setSelectedDateData(dateData);
  };

  return (
    <div className="app-container" style={{ display: 'flex', gap: '20px', padding: '20px', direction: 'rtl' }}>
      
      {/* לוח השנה */}
      <div style={{ flex: 1 }}>
        <Calendar onDateSelect={handleDateSelect} />
      </div>
      
      {/* קומפוננטת הטופס עם העטיפה החכמה */}
      <div style={{ flex: 1 }}>
        {selectedDateData ? (
          <BookingFormWrapper selectedDate={selectedDateData} />
        ) : (
          <div style={{ padding: '40px', textAlign: 'center', backgroundColor: '#f9fafb', borderRadius: '12px', border: '2px dashed #d1d5db', color: '#6b7280' }}>
            <h3>טרם נבחר תאריך</h3>
            <p>אנא בחרי תאריך פנוי מתוך לוח השנה כדי לפתוח את טופס הזנת הפרטים.</p>
          </div>
        )}
      </div>

    </div>
  );
}

interface WrapperProps {
  selectedDate: any;
}

const BookingFormWrapper = ({ selectedDate }: WrapperProps) => {
  
  // שימוש ב-useEffect שמקשיב לשינוי בתאריך - רץ בצורה מבוקרת פעם אחת בלבד בכל החלפת תאריך
  useEffect(() => {
    // נותנים לטופס חלקיק שנייה להתרנדר ב-DOM
    const timer = setTimeout(() => {
      const dateInput = document.querySelector('input[name="calendarDateId"]') as HTMLInputElement;
      
      if (dateInput) {
        // מעדכנים את ה-Value הישיר של האלמנט
        dateInput.value = selectedDate.date;
        
        // מייצרים אירוע שינוי סטנדרטי ש-React מבינה ומאזינה לו (לעיתים נדרש לשלוח 'change' ולעיתים 'input')
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
        if (nativeInputValueSetter) {
          nativeInputValueSetter.call(dateInput, selectedDate.date);
        }
        
        const event = new Event('input', { bubbles: true });
        dateInput.dispatchEvent(event);
      }
    }, 100);

    return () => clearTimeout(timer); // מנקה את הטיימר במידה והקומפוננטה נסגרת
  }, [selectedDate.date]); // תלויות מוגדרות: ירוץ רק כשהתאריך משתנה!

  return (
    <div key={selectedDate.date}>
      <BookingForm />
    </div>
  );
};

export default App;