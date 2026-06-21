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

/** יחס התמונה המקורית 1024×576 */
export const CANVAS_ASPECT = 1024 / 576;

export const SECTION_BOUNDS: Record<TableSection, { minX: number; maxX: number; minY: number; maxY: number }> = {
  women: { minX: 6, maxX: 32, minY: 20, maxY: 55 },
  men: { minX: 36, maxX: 69, minY: 20, maxY: 55 },
};

export const DEFAULT_TABLE_SIZE = 3.2;

export const DEFAULT_TABLE_LAYOUT: TableData[] = [
  // Women — 4×3 grid
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

  // Men — top row
  { id: 14, x: 38.5, y: 21, section: 'men' },
  { id: 15, x: 45.5, y: 21, section: 'men' },
  { id: 16, x: 52.5, y: 21, section: 'men' },
  { id: 17, x: 59.5, y: 21, section: 'men' },

  // Men — stepped cluster
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
