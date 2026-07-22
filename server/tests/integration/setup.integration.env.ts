import dotenv from 'dotenv';
import path from 'path';

// טוען DATABASE_URL / JWT_SECRET מה-.env של השרver (setup.env.ts מגדיר fallback שלא מתאים ל-dev)
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });

process.env.RUN_INTEGRATION_TESTS = 'true';
