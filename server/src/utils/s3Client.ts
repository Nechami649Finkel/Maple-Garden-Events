import { S3Client, type S3ClientConfig } from '@aws-sdk/client-s3';

let client: S3Client | undefined;

function buildS3ClientConfig(): S3ClientConfig {
  const region = process.env.AWS_REGION || 'il-central-1';
  const config: S3ClientConfig = { region };

  const endpoint = process.env.S3_ENDPOINT;
  if (endpoint) {
    config.endpoint = endpoint;
    config.forcePathStyle = true;
  }

  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    config.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    };
  }

  return config;
}

/**
 * Lazy singleton — created on first use, reused for the process lifetime.
 * Safe under the Node.js single-threaded event loop (sync init, no race).
 */
export function getS3Client(): S3Client {
  if (!client) {
    client = new S3Client(buildS3ClientConfig());
  }
  return client;
}

/** Test / shutdown helper — clears the cached instance. */
export function resetS3ClientForTests(): void {
  if (client) {
    client.destroy();
    client = undefined;
  }
}
