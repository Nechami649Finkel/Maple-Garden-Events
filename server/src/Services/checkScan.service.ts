import vision from '@google-cloud/vision';
import { logger } from '../utils/logger';
import {
  type DepositCheckDetails,
  parseCheckFromVisionText,
} from '../utils/checkOcrParse';

/** ADC — no API keys in code. Uses GOOGLE_APPLICATION_CREDENTIALS or the runtime service account. */
const visionClient = new vision.ImageAnnotatorClient({
  projectId: process.env.GOOGLE_CLOUD_PROJECT || 'mepal-project',
  // Use the HTTP/1.1 REST transport. Local filtered proxies can reset gRPC/HTTP2
  // streams with RST_STREAM code 2 before Vision returns a response.
  fallback: true,
});

const DATA_URL_PREFIX = /^data:image\/[a-zA-Z0-9.+-]+;base64,/;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // Vision practical limit for request payload

export class CheckScanError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'CheckScanError';
  }
}

export function stripBase64Prefix(imageBase64: string): string {
  return imageBase64.replace(DATA_URL_PREFIX, '').replace(/\s+/g, '');
}

function assertValidBase64Image(base64: string): Buffer {
  if (!base64) {
    throw new CheckScanError('חסרה תמונת צ׳ק (imageBase64)', 400);
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64, 'base64');
  } catch {
    throw new CheckScanError('תמונת הצ׳ק אינה בקידוד Base64 תקין', 400);
  }

  if (buffer.length < 64) {
    throw new CheckScanError('תמונת הצ׳ק קצרה מדי או פגומה', 400);
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new CheckScanError('תמונת הצ׳ק גדולה מדי (מקסימום 8MB)', 400);
  }

  if (!/^[A-Za-z0-9+/]+=*$/.test(base64)) {
    throw new CheckScanError('תמונת הצ׳ק אינה בקידוד Base64 תקין', 400);
  }

  return buffer;
}

/**
 * Run Google Cloud Vision documentTextDetection (Hebrew-optimized) and extract
 * bank / branch / account / check number from the returned full text + MICR band.
 */
export async function scanCheckWithVision(imageBase64Raw: string): Promise<DepositCheckDetails> {
  const base64 = stripBase64Prefix(imageBase64Raw);
  const content = assertValidBase64Image(base64);

  logger.info('Check scan: calling Vision documentTextDetection', {
    bytes: content.length,
  });

  const [result] = await visionClient.documentTextDetection({
    image: { content: content.toString('base64') },
    imageContext: {
      languageHints: ['he', 'en'],
    },
  });

  const fullText = result.fullTextAnnotation?.text?.trim() ?? '';
  if (!fullText) {
    const fallback = result.textAnnotations?.[0]?.description?.trim() ?? '';
    if (!fallback) {
      throw new CheckScanError('לא זוהה טקסט בתמונת הצ׳ק', 422);
    }
    logger.info('Check scan: using textAnnotations fallback (no fullTextAnnotation)');
    return parseCheckFromVisionText(fallback);
  }

  logger.info('Check scan: Vision text received', { chars: fullText.length });
  return parseCheckFromVisionText(fullText);
}
