import type { TableData } from '../constants/defaultTableLayout';
import { DEFAULT_TABLE_SIZE } from '../constants/defaultTableLayout';

const EXPORT_WIDTH = 1024;
const EXPORT_HEIGHT = 576;

const COLORS = {
  women: '#2196f3',
  men: '#4caf50',
  honor: '#ffb300',
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawTable(ctx: CanvasRenderingContext2D, table: TableData) {
  const x = (table.x / 100) * EXPORT_WIDTH;
  const y = (table.y / 100) * EXPORT_HEIGHT;
  const w = (DEFAULT_TABLE_SIZE / 100) * EXPORT_WIDTH;
  const h = (DEFAULT_TABLE_SIZE / 100) * EXPORT_HEIGHT;

  const fill = table.isHonor
    ? COLORS.honor
    : table.section === 'women'
      ? COLORS.women
      : COLORS.men;

  ctx.fillStyle = fill;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 4);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = table.isHonor ? '#333333' : '#ffffff';
  ctx.font = 'bold 14px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(table.isHonor ? 'R' : String(table.id), x + w / 2, y + h / 2);
}

export async function renderFloorPlanToDataUrl(
  tables: TableData[],
  imageSrc: string,
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = EXPORT_WIDTH;
  canvas.height = EXPORT_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('לא ניתן ליצור תמונה');

  const bg = await loadImage(imageSrc);
  ctx.drawImage(bg, 0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);

  for (const table of tables) {
    drawTable(ctx, table);
  }

  return canvas.toDataURL('image/png');
}

export async function exportFloorPlanAsImage(
  tables: TableData[],
  imageSrc: string,
  fileName = 'sidur-shulchanot.png',
): Promise<void> {
  const dataUrl = await renderFloorPlanToDataUrl(tables, imageSrc);
  const link = document.createElement('a');
  link.download = fileName;
  link.href = dataUrl;
  link.click();
}
