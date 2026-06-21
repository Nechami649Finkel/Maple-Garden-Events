import Tesseract from 'tesseract.js';
import {
  type DepositCheckDetails,
  type ScanCandidate,
  HIGH_CONFIDENCE_SCORE,
  buildScanResult,
  parseNumberOcrText,
  assembleFromLabels,
  selectSecurityCheckResult,
  extractBankCodeFromLabels,
} from './checkOcrParse';

export type { DepositCheckDetails } from './checkOcrParse';
export { runParseFixtures } from './checkOcrParse';

const PSM_MODES = ['6', '4', '11'] as const;

function enhanceForDigits(canvas: HTMLCanvasElement, threshold = 140): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = data[i + 1] = data[i + 2] = gray < threshold ? 0 : 255;
  }
  ctx.putImageData(imageData, 0, 0);
}

function loadRotatedCanvas(dataUrl: string, rotationDeg: number): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const rad = (rotationDeg * Math.PI) / 180;
      const sin = Math.abs(Math.sin(rad));
      const cos = Math.abs(Math.cos(rad));
      const w = img.width * cos + img.height * sin;
      const h = img.width * sin + img.height * cos;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('canvas'));
        return;
      }
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.translate(w / 2, h / 2);
      ctx.rotate(rad);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      const maxDim = Math.max(canvas.width, canvas.height);
      const scale = maxDim < 2800 ? 2800 / maxDim : 1;
      if (scale > 1) {
        const scaled = document.createElement('canvas');
        scaled.width = Math.round(canvas.width * scale);
        scaled.height = Math.round(canvas.height * scale);
        const sctx = scaled.getContext('2d')!;
        sctx.fillStyle = '#fff';
        sctx.fillRect(0, 0, scaled.width, scaled.height);
        sctx.drawImage(canvas, 0, 0, scaled.width, scaled.height);
        resolve(scaled);
        return;
      }
      resolve(canvas);
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function cropRegion(
  canvas: HTMLCanvasElement,
  region: 'top' | 'bottom' | 'topLeft' | 'bottomWide',
  fraction = 0.35
): HTMLCanvasElement {
  let sx = 0;
  let sy = 0;
  let sw = canvas.width;
  let sh = canvas.height;

  switch (region) {
    case 'top':
      sh = Math.floor(canvas.height * fraction);
      break;
    case 'bottom':
      sh = Math.floor(canvas.height * fraction);
      sy = canvas.height - sh;
      break;
    case 'bottomWide':
      sh = Math.floor(canvas.height * (fraction + 0.1));
      sy = canvas.height - sh;
      break;
    case 'topLeft':
      sw = Math.floor(canvas.width * 0.65);
      sh = Math.floor(canvas.height * 0.42);
      break;
  }

  const cropped = document.createElement('canvas');
  cropped.width = sw;
  cropped.height = sh;
  const ctx = cropped.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, sw, sh);
  ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
  return cropped;
}

function canvasToJpeg(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/jpeg', 0.94);
}

async function recognizeNumbers(
  imageSrc: string,
  worker: Tesseract.Worker,
  psm: string
): Promise<string> {
  await worker.setParameters({
    tessedit_char_whitelist: '0123456789 /',
    tessedit_pageseg_mode: psm,
  });
  const { data } = await worker.recognize(imageSrc);
  return data.text;
}

async function recognizeBankLabels(imageSrc: string, worker: Tesseract.Worker): Promise<string> {
  await worker.setParameters({ tessedit_pageseg_mode: '3' });
  const { data } = await worker.recognize(imageSrc);
  return data.text;
}

async function ocrNumbersRegion(
  imageSrc: string,
  worker: Tesseract.Worker,
  tag: string,
  bankHint: string | undefined,
  rawTexts: string[],
  candidates: ScanCandidate[]
): Promise<void> {
  for (const psm of PSM_MODES) {
    try {
      const text = await recognizeNumbers(imageSrc, worker, psm);
      rawTexts.push(`[${tag}-psm${psm}] ${text}`);
      candidates.push(...parseNumberOcrText(text, bankHint));
    } catch {
      // continue
    }
  }
}

async function scanCanvasAtAngle(
  canvas: HTMLCanvasElement,
  engWorker: Tesseract.Worker,
  hebWorker: Tesseract.Worker
): Promise<{ candidates: ScanCandidate[]; rawTexts: string[]; labelText: string }> {
  const candidates: ScanCandidate[] = [];
  const rawTexts: string[] = [];
  let labelText = '';

  const topLeft = cropRegion(canvas, 'topLeft');
  const top = cropRegion(canvas, 'top', 0.45);

  try {
    labelText = await recognizeBankLabels(canvasToJpeg(topLeft), hebWorker);
    rawTexts.push(`[labels-topLeft] ${labelText}`);
    const topLabels = await recognizeBankLabels(canvasToJpeg(top), hebWorker);
    labelText += '\n' + topLabels;
    rawTexts.push(`[labels-top] ${topLabels}`);
  } catch {
    // continue
  }

  const bankHint = extractBankCodeFromLabels(labelText);

  const numberRegions: { crop: HTMLCanvasElement; tag: string; enhance?: boolean }[] = [
    { crop: topLeft, tag: 'topLeft' },
    { crop: top, tag: 'top' },
    { crop: cropRegion(canvas, 'bottomWide', 0.28), tag: 'bottomWide', enhance: true },
    { crop: cropRegion(canvas, 'bottom', 0.22), tag: 'bottom', enhance: true },
  ];

  for (const { crop, tag, enhance } of numberRegions) {
    if (enhance) {
      for (const threshold of [130, 145, 160]) {
        const copy = document.createElement('canvas');
        copy.width = crop.width;
        copy.height = crop.height;
        copy.getContext('2d')!.drawImage(crop, 0, 0);
        enhanceForDigits(copy, threshold);
        await ocrNumbersRegion(canvasToJpeg(copy), engWorker, `${tag}-t${threshold}`, bankHint, rawTexts, candidates);
      }
    } else {
      await ocrNumbersRegion(canvasToJpeg(crop), engWorker, tag, bankHint, rawTexts, candidates);
    }
  }

  const assembled = assembleFromLabels(labelText, candidates);
  if (assembled) candidates.push(assembled);

  return { candidates, rawTexts, labelText };
}

export async function scanCheckImage(imageSrc: string): Promise<DepositCheckDetails> {
  const allCandidates: ScanCandidate[] = [];
  const allRawTexts: string[] = [];
  let allLabelText = '';

  const engWorker = await Tesseract.createWorker('eng');
  const hebWorker = await Tesseract.createWorker('heb+eng');

  try {
    for (const angle of [0, 90, 180, 270]) {
      try {
        const canvas = await loadRotatedCanvas(imageSrc, angle);
        const { candidates, rawTexts, labelText } = await scanCanvasAtAngle(canvas, engWorker, hebWorker);
        allCandidates.push(...candidates);
        allRawTexts.push(...rawTexts);
        allLabelText += '\n' + labelText;

        const interim = selectSecurityCheckResult(allCandidates, allLabelText);
        if (interim && interim.score >= HIGH_CONFIDENCE_SCORE) break;
      } catch {
        // continue
      }
    }
  } finally {
    await engWorker.terminate();
    await hebWorker.terminate();
  }

  const best = selectSecurityCheckResult(allCandidates, allLabelText);
  return buildScanResult(best, allRawTexts);
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
