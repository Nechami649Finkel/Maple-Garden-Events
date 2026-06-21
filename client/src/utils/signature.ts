import type React from 'react';
import type SignatureCanvas from 'react-signature-canvas';

export function getSignatureDataUrl(
  sigCanvas: React.RefObject<SignatureCanvas | null>
): string | null {
  const canvas = sigCanvas.current;
  if (!canvas || canvas.isEmpty()) return null;
  return canvas.getCanvas().toDataURL('image/png');
}
