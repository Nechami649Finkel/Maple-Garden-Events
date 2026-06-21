import './instrument';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { startCronJobs } from './utils/cronJobs';
import { initOrderSequence } from './utils/eventCode';
import { logger } from './utils/logger';
import app from './app';

const httpServer = createServer(app);

export const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  },
  maxHttpBufferSize: 5e6,
});

export const broadcastUpdate = (action: string, data: unknown) => {
  io.emit(action, data);
};

startCronJobs();

const PORT = Number(process.env.PORT) || 5000;

initOrderSequence()
  .then(() => {
    httpServer.listen(PORT, () => logger.info(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    logger.error('Failed to initialize order sequence', { error: err });
    process.exit(1);
  });
