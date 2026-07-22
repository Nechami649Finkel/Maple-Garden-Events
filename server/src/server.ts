import './instrument';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { socketAuthMiddleware } from './middlewares/socketAuth';
import { startCronJobs } from './utils/cronJobs';
import { initOrderSequence } from './utils/eventCode';
import { logger } from './utils/logger';
import { verifyEmailConnection } from './utils/mailer';
import { getEasyCountMeta } from './Services/easycount.service';
import app from './app';
import { getCorsOrigins } from './config/corsOrigins';

const httpServer = createServer(app);

export const io = new Server(httpServer, {
  cors: {
    origin: getCorsOrigins(),
    credentials: true,
  },
  maxHttpBufferSize: 5e6,
});

io.use(socketAuthMiddleware);

export const broadcastUpdate = (action: string, data: unknown) => {
  io.emit(action, data);
};

startCronJobs();

const PORT = Number(process.env.PORT) || 5000;
const HOST = process.env.HOST || '0.0.0.0';

initOrderSequence()
  .then(async () => {
    await verifyEmailConnection();
    const easycount = getEasyCountMeta();
    logger.info(`EZCount mode: ${easycount.mode} — ${easycount.label}`);
    httpServer.listen(PORT, HOST, () => logger.info(`Server running on http://${HOST}:${PORT}`));
  })
  .catch((err) => {
    logger.error('Failed to initialize order sequence', { error: err });
    process.exit(1);
  });
