import dotenv from 'dotenv';
import { runDatabaseBackup } from '../src/utils/databaseBackup';

dotenv.config();

runDatabaseBackup()
  .then((path) => {
    process.exit(path ? 0 : 1);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
