import { PrismaClient } from '@prisma/client';
import { withDbRetry } from '../utils/dbRetry';

const base = new PrismaClient();

const prisma = base.$extends({
  query: {
    $allModels: {
      async $allOperations({ args, query }) {
        return withDbRetry(() => query(args));
      },
    },
  },
});

export default prisma;
