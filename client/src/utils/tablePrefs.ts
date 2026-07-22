const PREFIX = 'maple-table-prefs:';

export interface TablePrefs {
  sortColumn?: string;
  sortDir?: 'asc' | 'desc';
  hiddenColumns?: string[];
  pageSize?: number;
}

export function loadTablePrefs(tableId: string): TablePrefs {
  try {
    const raw = localStorage.getItem(`${PREFIX}${tableId}`);
    if (!raw) return {};
    return JSON.parse(raw) as TablePrefs;
  } catch {
    return {};
  }
}

export function saveTablePrefs(tableId: string, prefs: TablePrefs): void {
  try {
    localStorage.setItem(`${PREFIX}${tableId}`, JSON.stringify(prefs));
  } catch {
    // ignore quota errors
  }
}
