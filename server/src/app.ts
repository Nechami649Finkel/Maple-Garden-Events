import express from 'express';
import cors from 'cors'; // 1. מוסיפים את הייבוא הזה
import bookingRoutes from './routes/booking.routes';
import calendarRoutes from './routes/calendar.routes'; // נתיב חדש לאירועים

const app = express();

// 2. אומרים לשרת לאשר בקשות מהדפדפן של ה-React שלנו
app.use(cors({
  origin: 'http://localhost:5173' 
}));

app.use(express.json());

// נתיבים
app.use('/api/bookings', bookingRoutes);
app.use('/api/calendar', calendarRoutes); // נתיב חדש לאירועים
export default app;