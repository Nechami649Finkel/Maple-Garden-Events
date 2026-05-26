import app from './app';
import http from 'http';
import { Server } from 'socket.io';

const PORT = process.env.PORT || 5000;

// 1. יצירת שרת ה-HTTP שמבוסס על האפליקציה שלך
const server = http.createServer(app);

// 2. חיבור ה-Socket לשרת ה-HTTP שיצרנו
export const io = new Server(server, { 
  cors: { origin: "*" } 
});

// 3. האזנה דרך ה-server שיצרנו, ולא דרך app.listen
server.listen(PORT, () => {
  console.log(`🚀 Server is running smoothly on http://localhost:${PORT}`);
});