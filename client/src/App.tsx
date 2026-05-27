// client/src/App.tsx
import React, { useState } from 'react';
import BookingForm from './components/BookingForm/BookingForm';
import { Calendar } from './components/Calendar/Calendar';
import './App.css';

function App() {
  const [selectedDateData, setSelectedDateData] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleDateSelect = (dateData: any) => {
    setSelectedDateData(dateData);
  };

  const handleBookingSaved = () => {
    setRefreshKey(k => k + 1); // מרענן את הלוח
    setSelectedDateData(null);  // סוגר את הטופס
  };

  return (
    <div className="app-container" style={{ display: 'flex', gap: '20px', padding: '20px', direction: 'rtl' }}>
      
      {/* לוח השנה */}
      <div style={{ flex: 1 }}>
        <Calendar key={refreshKey} onDateSelect={handleDateSelect} />
      </div>
      
      <div style={{ flex: 1 }}>
        {selectedDateData ? (
          <BookingFormWrapper selectedDate={selectedDateData} onSaved={handleBookingSaved} />
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
  onSaved: () => void;
}

const BookingFormWrapper = ({ selectedDate, onSaved }: WrapperProps) => {
  return (
    <div key={selectedDate.date}>
      <BookingForm initialDate={selectedDate.date} onSaved={onSaved} />
    </div>
  );
};

export default App;