import type React from 'react';
import type SignatureCanvas from 'react-signature-canvas';

/**
 * Export a PNG data-URL from the signature pad.
 * Returns null when the pad is missing or empty.
 */
export function getSignatureDataUrl(
  sigCanvas: React.RefObject<SignatureCanvas | null>,
): string | null {
  const pad = sigCanvas.current;
  if (!pad) return null;

  try {
    if (pad.isEmpty()) return null;
  } catch {
    return null;
  }

  try {
    // Prefer trimmed canvas so transparent margins don't bloat the payload.
    const trimmed = pad.getTrimmedCanvas();
    if (trimmed.width > 0 && trimmed.height > 0) {
      return trimmed.toDataURL('image/png');
    }
  } catch {
    // Fall through to the full canvas.
  }

  try {
    return pad.getCanvas().toDataURL('image/png');
  } catch {
    return null;
  }
}

/** True when a string looks like a stored signature image (data URL or http URL). */
export function isSignaturePayload(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  return (
    v.startsWith('data:image/') ||
    v.startsWith('https://') ||
    v.startsWith('http://') ||
    v.startsWith('/api/files/')
  );
}
