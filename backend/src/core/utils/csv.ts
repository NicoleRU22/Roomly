export interface CsvColumn<T> {
  key: keyof T | ((row: T) => unknown);
  header: string;
}

// Serializa filas a CSV (RFC 4180 básico): escapa comillas, comas y saltos de línea.
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const escape = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    const str = value instanceof Date ? value.toISOString() : String(value);
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = columns.map((col) => escape(col.header)).join(',');
  const lines = rows.map((row) =>
    columns
      .map((col) => escape(typeof col.key === 'function' ? col.key(row) : row[col.key]))
      .join(',')
  );

  return [header, ...lines].join('\r\n');
}
