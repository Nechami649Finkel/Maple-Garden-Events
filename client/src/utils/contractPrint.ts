import { API_BASE } from '../config/api';

export function getContractPdfUrl(bookingId: string | number): string {
  return `${API_BASE}/api/bookings/${bookingId}/contract-pdf`;
}

export async function fetchContractPdf(bookingId: string | number): Promise<Blob> {
  const response = await fetch(getContractPdfUrl(bookingId), { credentials: 'include' });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || 'לא ניתן לטעון את החוזה');
  }
  return response.blob();
}

export function openContractPdf(bookingId: string | number): void {
  window.open(getContractPdfUrl(bookingId), '_blank');
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
  } catch {
    alert('לא הצלחנו להדפיס את החוזה. ניתן להדפיס מאוחר יותר ממסך עריכת ההזמנה.');
  }
}
