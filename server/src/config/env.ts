import dotenv from 'dotenv';
import { logger } from '../utils/logger';

dotenv.config();

const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'GOOGLE_CLIENT_ID',
];

export const validateEnv = () => {
  const missing = requiredEnvVars.filter((envVar) => !process.env[envVar]);
  if (missing.length > 0) {
    logger.error(`Critical: missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
  logger.info('Environment variables loaded successfully');
};