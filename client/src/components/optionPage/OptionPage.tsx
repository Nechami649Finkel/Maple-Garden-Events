import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import BookingForm from '../BookingForm/BookingForm';
import './OptionPage.css';

const OptionPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // כאן אנחנו שואבים את התאריכים מהניווט
  const selectedDates = location.state?.selectedDates || [];

  if (selectedDates.length === 0) {
    return (
      <div className="option-page-container">
        <h3>לא נבחרו תאריכים.</h3>
        <button onClick={() => navigate('/')}>חזרה ללוח</button>
      </div>
    );
  }

  // שולחים ל-BookingForm את התאריכים ואומרים לו "אתה במצב אופציה"
  return (
    <BookingForm 
      initialDates={selectedDates} 
      isOption={true} 
    />
  );
};

export default OptionPage;