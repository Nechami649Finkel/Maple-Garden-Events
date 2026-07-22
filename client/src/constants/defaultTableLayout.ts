export type TableSection = 'women' | 'men';

export interface TableData {
  id: number;
  x: number;
  y: number;
  section: TableSection;
  isHonor?: boolean;
  width?: number;
  height?: number;
}

export interface LayoutBuildParams {
  guestCount: number;
  seatingType?: 'separate' | 'mixed' | string;
  menPercent?: number;
  womenPercent?: number;
  includeHonorTables?: boolean;
  seatsPerTable?: number;
}

export interface LayoutStats {
  guestCount: number;
  seatsPerTable: number;
  requiredTables: number;
  tableCount: number;
  totalSeats: number;
  seatDelta: number;
}

/** כסאות לשולחן — קבוע לגן */
export const SEATS_PER_TABLE = 12;

/** יחס התמונה המקורית 1024×576 */
export const CANVAS_ASPECT = 1024 / 576;

export const SECTION_BOUNDS: Record<TableSection, { minX: number; maxX: number; minY: number; maxY: number }> = {
  women: { minX: 6, maxX: 32, minY: 20, maxY: 55 },
  men: { minX: 36, maxX: 69, minY: 20, maxY: 55 },
};

export const DEFAULT_TABLE_SIZE = 3.2;

export const DEFAULT_TABLE_LAYOUT: TableData[] = [
  { id: 1, x: 10, y: 24, section: 'women' },
  { id: 2, x: 16.5, y: 24, section: 'women' },
  { id: 3, x: 23, y: 24, section: 'women' },
  { id: 4, x: 29.5, y: 24, section: 'women' },
  { id: 5, x: 10, y: 32, section: 'women' },
  { id: 6, x: 16.5, y: 32, section: 'women' },
  { id: 7, x: 23, y: 32, section: 'women' },
  { id: 8, x: 29.5, y: 32, section: 'women' },
  { id: 9, x: 10, y: 40, section: 'women' },
  { id: 10, x: 16.5, y: 40, section: 'women' },
  { id: 11, x: 23, y: 40, section: 'women' },
  { id: 12, x: 29.5, y: 40, section: 'women' },
  { id: 13, x: 10, y: 48, section: 'women', isHonor: true },
  { id: 14, x: 38.5, y: 21, section: 'men' },
  { id: 15, x: 45.5, y: 21, section: 'men' },
  { id: 16, x: 52.5, y: 21, section: 'men' },
  { id: 17, x: 59.5, y: 21, section: 'men' },
  { id: 18, x: 38, y: 29, section: 'men' },
  { id: 19, x: 44, y: 29, section: 'men' },
  { id: 20, x: 50, y: 29, section: 'men' },
  { id: 21, x: 56, y: 29, section: 'men' },
  { id: 22, x: 38, y: 37, section: 'men' },
  { id: 23, x: 44, y: 37, section: 'men' },
  { id: 24, x: 50, y: 37, section: 'men' },
  { id: 25, x: 56, y: 37, section: 'men' },
  { id: 26, x: 44, y: 45, section: 'men' },
  { id: 27, x: 59, y: 49, section: 'men', isHonor: true },
];

function getSectionSlotPositions(section: TableSection): {
  regular: Array<{ x: number; y: number }>;
  honor: { x: number; y: number } | null;
} {
  const sectionTables = DEFAULT_TABLE_LAYOUT.filter(t => t.section === section);
  const honorTable = sectionTables.find(t => t.isHonor);
  return {
    regular: sectionTables.filter(t => !t.isHonor).map(t => ({ x: t.x, y: t.y })),
    honor: honorTable ? { x: honorTable.x, y: honorTable.y } : null,
  };
}

function extendSlotPositions(
  section: TableSection,
  baseSlots: Array<{ x: number; y: number }>,
  needed: number,
): Array<{ x: number; y: number }> {
  if (needed <= baseSlots.length) {
    return baseSlots.slice(0, needed);
  }

  const bounds = SECTION_BOUNDS[section];
  const cols = section === 'women' ? 4 : 4;
  const slots = [...baseSlots];
  const stepX = cols > 1
    ? (bounds.maxX - bounds.minX - DEFAULT_TABLE_SIZE) / (cols - 1)
    : 0;
  const stepY = 5.5;
  let index = slots.length;

  while (slots.length < needed) {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = bounds.minX + col * stepX;
    const y = bounds.minY + row * stepY;
    if (y + DEFAULT_TABLE_SIZE > bounds.maxY) break;
    slots.push({ x, y });
    index += 1;
  }

  return slots.slice(0, needed);
}

export function buildLayoutForGuestCount(params: LayoutBuildParams): TableData[] {
  const seatsPerTable = params.seatsPerTable ?? SEATS_PER_TABLE;
  const guestCount = Math.max(0, params.guestCount || 0);

  if (guestCount <= 0) {
    return DEFAULT_TABLE_LAYOUT.map(t => ({ ...t }));
  }

  const includeHonor = params.includeHonorTables !== false;
  const honorTableCount = includeHonor ? 2 : 0;
  const totalTables = Math.ceil(guestCount / seatsPerTable);
  const regularTotal = Math.max(0, totalTables - honorTableCount);

  let womenRegular = 0;
  let menRegular = regularTotal;

  if (params.seatingType === 'separate') {
    const womenPct = params.womenPercent ?? params.menPercent != null
      ? 100 - (params.menPercent ?? 50)
      : 50;
    womenRegular = Math.round(regularTotal * womenPct / 100);
    menRegular = regularTotal - womenRegular;
  } else if (params.seatingType === 'mixed') {
    womenRegular = Math.floor(regularTotal / 2);
    menRegular = regularTotal - womenRegular;
  }

  const womenSlots = getSectionSlotPositions('women');
  const menSlots = getSectionSlotPositions('men');
  const womenPositions = extendSlotPositions('women', womenSlots.regular, womenRegular);
  const menPositions = extendSlotPositions('men', menSlots.regular, menRegular);

  const tables: TableData[] = [];
  let nextId = 1;

  for (const pos of womenPositions) {
    tables.push(clampToSection({ id: nextId++, x: pos.x, y: pos.y, section: 'women' }));
  }
  if (includeHonor && womenSlots.honor) {
    tables.push(clampToSection({
      id: nextId++,
      x: womenSlots.honor.x,
      y: womenSlots.honor.y,
      section: 'women',
      isHonor: true,
    }));
  }
  for (const pos of menPositions) {
    tables.push(clampToSection({ id: nextId++, x: pos.x, y: pos.y, section: 'men' }));
  }
  if (includeHonor && menSlots.honor) {
    tables.push(clampToSection({
      id: nextId,
      x: menSlots.honor.x,
      y: menSlots.honor.y,
      section: 'men',
      isHonor: true,
    }));
  }

  return tables;
}

export function computeLayoutStats(
  tables: TableData[],
  guestCount: number,
  seatsPerTable: number = SEATS_PER_TABLE,
): LayoutStats {
  const tableCount = tables.length;
  const totalSeats = tableCount * seatsPerTable;
  const requiredTables = guestCount > 0 ? Math.ceil(guestCount / seatsPerTable) : 0;
  return {
    guestCount,
    seatsPerTable,
    requiredTables,
    tableCount,
    totalSeats,
    seatDelta: totalSeats - guestCount,
  };
}

export function clampToSection(table: TableData): TableData {
  const bounds = SECTION_BOUNDS[table.section];
  return {
    ...table,
    x: Math.min(bounds.maxX - DEFAULT_TABLE_SIZE, Math.max(bounds.minX, table.x)),
    y: Math.min(bounds.maxY - DEFAULT_TABLE_SIZE, Math.max(bounds.minY, table.y)),
    width: undefined,
    height: undefined,
  };
}

export function getNextTableId(tables: TableData[]): number {
  if (tables.length === 0) return 1;
  return Math.max(...tables.map(t => t.id)) + 1;
}

export function createTableInSection(section: TableSection, id: number): TableData {
  const bounds = SECTION_BOUNDS[section];
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  return clampToSection({ id, x: centerX, y: centerY, section });
}

export function serverTablesToClient(tables: Array<{
  tableNumber: number;
  positionX: number;
  positionY: number;
  section?: string | null;
  isHonor?: boolean;
  width?: number | null;
  height?: number | null;
}>): TableData[] {
  return tables.map(t => clampToSection({
    id: t.tableNumber,
    x: t.positionX,
    y: t.positionY,
    section: (t.section === 'men' ? 'men' : 'women') as TableSection,
    isHonor: t.isHonor ?? false,
  }));
}

export function clientTablesToServer(tables: TableData[]) {
  return tables.map(t => ({
    id: t.id,
    x: t.x,
    y: t.y,
    section: t.section,
    isHonor: t.isHonor ?? false,
    width: null,
    height: null,
  }));
}
