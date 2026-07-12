import { API_BASE } from '../config/api';
import { secureFetch } from '../services/api';

export function getContractPdfUrl(bookingId: string | number): string {
  return `${API_BASE}/api/bookings/${bookingId}/contract-pdf`;
}

async function parseApiError(response: Response): Promise<string> {
  const err = await response.json().catch(() => ({}));
  return (err as { message?: string }).message || 'לא ניתן לטעון את החוזה';
}

export async function fetchContractPdf(bookingId: string | number): Promise<Blob> {
  const response = await secureFetch(getContractPdfUrl(bookingId));
  const contentType = response.headers.get('Content-Type') || '';

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  if (!contentType.includes('application/pdf')) {
    throw new Error(await parseApiError(response));
  }

  return response.blob();
}

export async function openContractPdf(bookingId: string | number): Promise<void> {
  try {
    const blob = await fetchContractPdf(bookingId);
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    alert(e instanceof Error ? e.message : 'לא ניתן לטעון את החוזה');
  }
}

/** פותח דיאלוג הדפסה של הדפדפן — המשתמש בוחר מדפסת מחוברת */
export async function printContract(bookingId: string | number): Promise<void> {
  const blob = await fetchContractPdf(bookingId);
  const blobUrl = URL.createObjectURL(blob);

  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', 'הדפסת חוזה');
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
      reject(new Error('שגיאה בטעינת החוזה להדפסה'));
    };
  });
}

export async function promptPrintAfterClose(bookingId: string | number): Promise<void> {
  const shouldPrint = window.confirm('החוזה נשלח במייל ובוואטסאפ.\nלהדפיס עותק עכשיו?');
  if (!shouldPrint) return;
  try {
    await printContract(bookingId);
  } catch (e) {
    alert(e instanceof Error ? e.message : 'לא הצלחנו להדפיס את החוזה. ניתן להדפיס מאוחר יותר ממסך עריכת ההזמנה.');
  }
}
