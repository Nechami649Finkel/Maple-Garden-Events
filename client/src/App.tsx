import BookingForm from './components/BookingForm/BookingForm';

function App() {
  return (
    <div>
      <BookingForm />
    </div>
  );
}

export default App;
// function App() {
//   // כאן אנחנו שומרים את התאריך שנבחר
//   const [selectedDate, setSelectedDate] = useState(null);

//   return (
//     <div>
//       {/* 1. מציגים את הלוח תמיד */}
//       <Calendar onDateSelect={(date) => setSelectedDate(date)} />

//       {/* 2. מציגים את הטופס רק אם selectedDate הוא לא null */}
//       {selectedDate && <BookingForm />}
//     </div>
//   );
// }
