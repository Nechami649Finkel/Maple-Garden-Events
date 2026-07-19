import { useTranslation } from '../../i18n/useTranslation';
import styles from './DataTable.module.css';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
}

interface DataTableProps<T> {
  caption: string;
  columns: DataTableColumn<T>[];
  data: T[];
  rowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  emptyMessage?: string;
}

export function DataTable<T>({
  caption,
  columns,
  data,
  rowKey,
  onRowClick,
  sortKey,
  sortDir,
  onSort,
  emptyMessage,
}: DataTableProps<T>) {
  const { t, T } = useTranslation();
  const resolvedEmpty = emptyMessage ?? t(T.UI.EMPTY_TABLE);

  if (data.length === 0) {
    return <p className={styles.empty}>{resolvedEmpty}</p>;
  }

  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                style={col.width ? { width: col.width } : undefined}
                aria-sort={
                  col.sortable && sortKey === col.key
                    ? sortDir === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : col.sortable
                      ? 'none'
                      : undefined
                }
              >
                {col.sortable && onSort ? (
                  <button
                    type="button"
                    className={styles.sortBtn}
                    onClick={() => onSort(col.key)}
                  >
                    {col.header}
                    {sortKey === col.key && (
                      <span aria-hidden="true">{sortDir === 'asc' ? ' ↑' : ' ↓'}</span>
                    )}
                  </button>
                ) : (
                  col.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={rowKey(row)}
              className={onRowClick ? styles.clickable : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={
                onRowClick
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onRowClick(row);
                      }
                    }
                  : undefined
              }
            >
              {columns.map((col) => (
                <td key={col.key}>{col.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
