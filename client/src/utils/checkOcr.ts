import { API_BASE } from '../config/api';
import { apiFetch } from '../services/api';
import type { DepositCheckDetails } from './checkOcrParse';

export type { DepositCheckDetails } from './checkOcrParse';
export { runParseFixtures } from './checkOcrParse';

/**
 * Scan a check image via the server (Google Cloud Vision + ADC).
 * Accepts a data URL or raw base64 string.
 */
export async function scanCheckImage(imageSrc: string): Promise<DepositCheckDetails> {
  const response = await apiFetch(`${API_BASE}/api/scan-check`, {
    method: 'POST',
    body: JSON.stringify({ imageBase64: imageSrc }),
  });

  const json = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    details?: DepositCheckDetails;
    error?: string;
  };

  if (response.status === 422) {
    return {
      scannedAt: new Date().toISOString(),
      scanConfidence: 'none',
      rawText: json.error || 'לא זוהה טקסט בתמונת הצ׳ק',
    };
  }

  if (!response.ok) {
    throw new Error(json.error || `שגיאה בסריקת הצ׳ק (${response.status})`);
  }

  if (!json.details) {
    throw new Error('תשובת שרת לא תקינה בסריקת צ׳ק');
  }

  return json.details;
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
