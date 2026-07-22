import { API_BASE } from '../config/api';
import { secureFetch } from '../services/api';
import { T, type TranslationKey } from '@shared/i18n';

type TranslateFn = (key: TranslationKey) => string;

async function parseApiError(response: Response, t: TranslateFn): Promise<string> {
  const err = await response.json().catch(() => ({}));
  return (err as { message?: string }).message || t(T.CONTRACT.LOAD_ERROR);
}

export function getContractPdfUrl(bookingId: string | number): string {
  return `${API_BASE}/api/bookings/${bookingId}/contract-pdf`;
}

export async function fetchContractPdf(bookingId: string | number, t: TranslateFn): Promise<Blob> {
  const response = await secureFetch(getContractPdfUrl(bookingId));
  const contentType = response.headers.get('Content-Type') || '';

  if (!response.ok) {
    throw new Error(await parseApiError(response, t));
  }

  if (!contentType.includes('application/pdf')) {
    throw new Error(await parseApiError(response, t));
  }

  return response.blob();
}

export async function openContractPdf(
  bookingId: string | number,
  t: TranslateFn,
): Promise<void> {
  try {
    const blob = await fetchContractPdf(bookingId, t);
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    alert(e instanceof Error ? e.message : t(T.CONTRACT.LOAD_ERROR));
  }
}

export async function printContract(
  bookingId: string | number,
  t: TranslateFn,
): Promise<void> {
  const blob = await fetchContractPdf(bookingId, t);
  const blobUrl = URL.createObjectURL(blob);

  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', t(T.CONTRACT.PRINT_TITLE));
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none';
  iframe.src = blobUrl;
  document.body.appendChild(iframe);

  await new Promise<void>((resolve, reject) => {
    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        resolve();
      } catch (e) {
        reject(e);
      } finally {
        setTimeout(() => {
          iframe.remove();
          URL.revokeObjectURL(blobUrl);
        }, 1500);
      }
    };
    iframe.onerror = () => {
      iframe.remove();
      URL.revokeObjectURL(blobUrl);
      reject(new Error(t(T.CONTRACT.PRINT_LOAD_ERROR)));
    };
  });
}

export async function promptPrintAfterClose(
  bookingId: string | number,
  t: TranslateFn,
): Promise<void> {
  const shouldPrint = window.confirm(t(T.CONTRACT.PRINT_PROMPT));
  if (!shouldPrint) return;
  try {
    await printContract(bookingId, t);
  } catch (e) {
    alert(e instanceof Error ? e.message : t(T.CONTRACT.PRINT_FAILED));
  }
}
