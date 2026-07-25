/**
 * Unified EasyCount configuration.
 *
 * Canonical env prefix: EASYCOUNT_*
 * Legacy EASY_COUNT_* keys are still read as fallbacks for existing deployments.
 */

export type EasyCountMode = 'off' | 'simulation' | 'sandbox' | 'live';

const DEFAULT_API_TIMEOUT_MS = 20_000;

function readEnv(primary: string, legacy?: string): string | undefined {
  const value = process.env[primary]?.trim() || (legacy ? process.env[legacy]?.trim() : undefined);
  return value || undefined;
}

function readBool(primary: string, legacy?: string): boolean {
  const raw = readEnv(primary, legacy)?.toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}

export function getEasyCountApiTimeoutMs(): number {
  const raw = Number(readEnv('EASYCOUNT_API_TIMEOUT_MS', 'EASY_COUNT_API_TIMEOUT_MS'));
  if (Number.isFinite(raw) && raw >= 1000 && raw <= 120_000) return Math.floor(raw);
  return DEFAULT_API_TIMEOUT_MS;
}

/** Native EZCount document API credentials (advance receipts). */
export function hasDocumentApiCredentials(): boolean {
  return Boolean(
    readEnv('EASYCOUNT_API_KEY', 'EASY_COUNT_API_KEY')
    && readEnv('EASYCOUNT_DEVELOPER_EMAIL'),
  );
}

/** Hall-invoice REST API credentials. */
export function hasInvoiceApiCredentials(): boolean {
  return Boolean(
    readEnv('EASYCOUNT_API_URL', 'EASY_COUNT_API_URL')
    && readEnv('EASYCOUNT_API_KEY', 'EASY_COUNT_API_KEY'),
  );
}

export function isEasyCountMockMode(): boolean {
  return readBool('EASYCOUNT_MOCK_MODE', 'EASY_COUNT_MOCK_MODE');
}

export function resolveEasyCountMode(): EasyCountMode {
  const raw = (readEnv('EASYCOUNT_MODE', 'EASY_COUNT_MODE') || 'simulation').toLowerCase();
  if (raw === 'off') return 'off';
  if (raw === 'live') return hasDocumentApiCredentials() ? 'live' : 'simulation';
  if (raw === 'sandbox') return hasDocumentApiCredentials() ? 'sandbox' : 'simulation';
  return 'simulation';
}

export function getDocumentApiBaseUrl(mode: EasyCountMode): string {
  if (mode === 'sandbox') return 'https://demo.ezcount.co.il';
  return 'https://www.ezcount.co.il';
}

export function getEasyCountApiKey(): string | undefined {
  return readEnv('EASYCOUNT_API_KEY', 'EASY_COUNT_API_KEY');
}

export function getEasyCountDeveloperEmail(): string | undefined {
  return readEnv('EASYCOUNT_DEVELOPER_EMAIL');
}

export function getInvoiceApiBaseUrl(): string | undefined {
  return readEnv('EASYCOUNT_API_URL', 'EASY_COUNT_API_URL')?.replace(/\/$/, '');
}

export function getEasyCountMerchantId(): string | undefined {
  return readEnv('EASYCOUNT_MERCHANT_ID', 'EASY_COUNT_MERCHANT_ID');
}

export function getEasyCountWebhookSecret(): string | undefined {
  return readEnv('EASYCOUNT_WEBHOOK_SECRET', 'EASY_COUNT_WEBHOOK_SECRET');
}

export function shouldSendAdvanceReceiptEmail(): boolean {
  return readBool('EASYCOUNT_SEND_EMAIL', 'EASY_COUNT_SEND_EMAIL');
}

export function getEasyCountMeta() {
  const mode = resolveEasyCountMode();
  return {
    mode,
    configured: hasDocumentApiCredentials() || hasInvoiceApiCredentials() || isEasyCountMockMode(),
    canIssueRealDocuments: mode === 'live' || mode === 'sandbox',
    mockMode: isEasyCountMockMode(),
    label:
      mode === 'off'
        ? 'כבוי'
        : mode === 'simulation'
          ? 'סימולציה — לא מופקות קבלות אמיתיות'
          : mode === 'sandbox'
            ? 'Sandbox (demo.ezcount.co.il)'
            : 'Production (ezcount.co.il)',
  };
}

export function isEasyCountConfigured(): boolean {
  return isEasyCountMockMode()
    || hasInvoiceApiCredentials()
    || hasDocumentApiCredentials();
}

/**
 * fetch() wrapper with AbortController timeout for EasyCount HTTP calls.
 */
export async function easyCountFetch(
  url: string,
  init: RequestInit = {},
  timeoutMs = getEasyCountApiTimeoutMs(),
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      const timeoutError: Error & { statusCode?: number } = new Error(
        `EasyCount API timeout after ${timeoutMs}ms`,
      );
      timeoutError.statusCode = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
