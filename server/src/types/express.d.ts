import 'express-serve-static-core';

declare module 'express-serve-static-core' {
  interface Request {
    /** Original webhook payload bytes (set by express.raw + HMAC middleware). */
    rawBody?: Buffer;
  }
}
