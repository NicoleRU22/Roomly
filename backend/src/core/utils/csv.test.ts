import { describe, it, expect } from 'vitest';
import { toCsv } from './csv';

interface Row {
  id: number;
  name: string;
  note?: string | null;
  createdAt?: Date;
}

describe('toCsv', () => {
  it('genera cabecera y filas separadas por CRLF', () => {
    const rows: Row[] = [{ id: 1, name: 'Ana' }, { id: 2, name: 'Luis' }];
    const csv = toCsv(rows, [{ key: 'id', header: 'ID' }, { key: 'name', header: 'Nombre' }]);
    expect(csv).toBe('ID,Nombre\r\n1,Ana\r\n2,Luis');
  });

  it('escapa valores que contienen comas envolviéndolos en comillas', () => {
    const rows: Row[] = [{ id: 1, name: 'Pérez, Ana' }];
    const csv = toCsv(rows, [{ key: 'name', header: 'Nombre' }]);
    expect(csv).toBe('Nombre\r\n"Pérez, Ana"');
  });

  it('escapa comillas dobles duplicándolas', () => {
    const rows: Row[] = [{ id: 1, name: 'Alias "El Jefe"' }];
    const csv = toCsv(rows, [{ key: 'name', header: 'Nombre' }]);
    expect(csv).toBe('Nombre\r\n"Alias ""El Jefe"""');
  });

  it('escapa valores con saltos de línea', () => {
    const rows: Row[] = [{ id: 1, name: 'Línea1\nLínea2' }];
    const csv = toCsv(rows, [{ key: 'name', header: 'Nombre' }]);
    expect(csv).toBe('Nombre\r\n"Línea1\nLínea2"');
  });

  it('representa null/undefined como celda vacía', () => {
    const rows: Row[] = [{ id: 1, name: 'Ana', note: null }];
    const csv = toCsv(rows, [{ key: 'note', header: 'Nota' }]);
    expect(csv).toBe('Nota\r\n');
  });

  it('serializa fechas en formato ISO', () => {
    const date = new Date('2026-01-15T00:00:00.000Z');
    const rows: Row[] = [{ id: 1, name: 'Ana', createdAt: date }];
    const csv = toCsv(rows, [{ key: 'createdAt', header: 'Creado' }]);
    expect(csv).toBe('Creado\r\n2026-01-15T00:00:00.000Z');
  });

  it('soporta columnas derivadas mediante función', () => {
    const rows: Row[] = [{ id: 1, name: 'Ana' }];
    const csv = toCsv(rows, [{ key: (row) => `#${row.id} - ${row.name}`, header: 'Resumen' }]);
    expect(csv).toBe('Resumen\r\n#1 - Ana');
  });

  it('devuelve solo la cabecera cuando no hay filas', () => {
    const csv = toCsv([], [{ key: 'id', header: 'ID' }]);
    expect(csv).toBe('ID');
  });
});
