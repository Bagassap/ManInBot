import { describe, expect, it } from 'vitest';
import {
  addSheet,
  clearRange,
  colToLetters,
  evaluateAll,
  findSheet,
  formatRange,
  LIMITS,
  lettersToCol,
  newWorkbook,
  parseRange,
  parseRef,
  SheetError,
  writeRows,
  type Workbook,
} from './engine.js';

const val = (wb: Workbook, ref: string, sheet = 'Sheet1') => evaluateAll(wb)[sheet][ref];

function book(rows: unknown[][], start = 'A1'): Workbook {
  const wb = newWorkbook();
  writeRows(wb, wb.sheets[0], start, rows);
  return wb;
}

describe('alamat sel', () => {
  it('kolom <-> huruf', () => {
    expect([1, 26, 27, 52, 53].map(colToLetters)).toEqual(['A', 'Z', 'AA', 'AZ', 'BA']);
    expect(lettersToCol('AA')).toBe(27);
    expect(lettersToCol('bh')).toBe(60);
  });
  it('parseRef dan parseRange', () => {
    expect(parseRef('b12')).toEqual({ col: 2, row: 12 });
    expect(parseRef('$C$3')).toEqual({ col: 3, row: 3 });
    expect(parseRef('12B')).toBeNull();
    expect(parseRange('C5:A1')).toEqual({ c1: 1, r1: 1, c2: 3, r2: 5 });
    expect(parseRange('B2')).toEqual({ c1: 2, r1: 2, c2: 2, r2: 2 });
    expect(parseRange('A1:')).toBeNull();
  });
});

describe('rumus', () => {
  const data = book([
    ['Item', 'Qty', 'Harga'],
    ['Apel', 10, 2500],
    ['Jeruk', 4, 3000],
    ['Mangga', 6, 4000],
  ]);

  it.each([
    ['=SUM(B2:B4)', 20],
    ['=AVERAGE(B2:B4)', 20 / 3],
    ['=MAX(C2:C4)', 4000],
    ['=MIN(C2:C4)', 2500],
    ['=COUNT(B2:B4)', 3],
    ['=COUNTA(A1:A4)', 4],
    ['=MEDIAN(B2:B4)', 6],
    ['=LARGE(B2:B4,2)', 6],
    ['=SMALL(B2:B4,1)', 4],
    ['=SUMPRODUCT(B2:B4,C2:C4)', 10 * 2500 + 4 * 3000 + 6 * 4000],
    ['=IF(B2>5,"banyak","sedikit")', 'banyak'],
    ['=ROUND(B2/3,2)', 3.33],
    ['=SUMIF(B2:B4,">5",C2:C4)', 2500 + 4000],
    ['=SUMIFS(C2:C4,B2:B4,">5",A2:A4,"A*")', 2500],
    ['=COUNTIFS(B2:B4,">=6")', 2],
    ['=VLOOKUP("Jeruk",A2:C4,3,FALSE)', 3000],
    ['=MATCH("Mangga",A2:A4,0)', 3],
    ['=LEN(A2)', 4],
    ['=UPPER(A3)', 'JERUK'],
    ['=SUBSTITUTE("a-b-c","-","+")', 'a+b+c'],
    ['=VALUE("1,250")', 1250],
    ['=B2*C2+B3*C3', 10 * 2500 + 4 * 3000],
  ])('%s', (formula, expected) => {
    const wb = structuredClone(data);
    writeRows(wb, wb.sheets[0], 'E1', [[formula]]);
    const r = val(wb, 'E1');
    expect(r.e).toBeUndefined();
    if (typeof expected === 'number') expect(r.v).toBeCloseTo(expected, 10);
    else expect(r.v).toBe(expected);
  });

  it('membersihkan artefak pecahan biner', () => {
    expect(val(book([['=0.1+0.2']]), 'A1').v).toBe(0.3);
    expect(val(book([['=12500000*1.11']]), 'A1').v).toBe(13875000);
  });

  it('rumus bertingkat dihitung ulang mengikuti perubahan sel', () => {
    const wb = book([[2, '=A1*10', '=B1+1']]);
    expect(val(wb, 'C1').v).toBe(21);
    writeRows(wb, wb.sheets[0], 'A1', [[5]]);
    expect(val(wb, 'C1').v).toBe(51);
  });
});

describe('galat', () => {
  it('pembagian nol dan perambatan lewat referensi sel', () => {
    const wb = book([[1, 0, '=A1/B1', '=C1+1', '=IFERROR(C1,-1)']]);
    expect(val(wb, 'C1').e).toBe('#DIV/0!');
    expect(val(wb, 'D1').e).toBe('#DIV/0!');
    expect(val(wb, 'E1').v).toBe(-1);
  });
  it('fungsi tidak dikenal -> #NAME? dengan petunjuk', () => {
    const r = val(book([['=XLOOKUP(1,A2:A3,B2:B3)']]), 'A1');
    expect(r.e).toBe('#NAME?');
    expect(r.m).toContain('XLOOKUP');
  });
  it('rumus salah tulis -> #ERROR! (tidak melempar)', () => {
    expect(val(book([['=SUM(1,']]), 'A1').e).toBe('#ERROR!');
    expect(val(book([['=1+']]), 'A1').e).toBe('#ERROR!');
  });
  it('referensi melingkar -> #CIRC!', () => {
    const wb = book([['=B1+1', '=A1+1']]);
    expect(val(wb, 'A1').e).toBe('#CIRC!');
    expect(val(wb, 'B1').e).toBe('#CIRC!');
    expect(val(book([['=A1']]), 'A1').e).toBe('#CIRC!');
  });
  it('referensi ke sheet yang tidak ada -> galat, bukan crash', () => {
    expect(val(book([['=Hilang!A1']]), 'A1').e).toBeTruthy();
  });
  it('rentang raksasa ditolak (anti-DoS)', () => {
    expect(val(book([['=SUM(A2:ZZ900000)']]), 'A1').e).toBeTruthy();
  });
  it('rantai rumus yang sangat dalam tidak membuat tumpukan meluap', () => {
    const wb = newWorkbook();
    const s = wb.sheets[0];
    for (let i = 1; i <= 1200; i++) s.cells[`A${i}`] = i === 1 ? { v: 1 } : { f: `A${i - 1}+1` };
    expect(() => evaluateAll(wb)).not.toThrow();
  });
});

describe('antar-sheet', () => {
  it('referensi tanpa nama sheet menunjuk sheet sendiri; bernama menunjuk sheet lain (termasuk spasi)', () => {
    const wb = newWorkbook();
    writeRows(wb, wb.sheets[0], 'A1', [[100]]);
    const s2 = addSheet(wb, 'Data Bulan 1');
    writeRows(wb, s2, 'A1', [[5, '=A1*2', "=Sheet1!A1+A1", "='Data Bulan 1'!B1+1"]]);
    const all = evaluateAll(wb);
    expect(all['Data Bulan 1'].B1.v).toBe(10);
    expect(all['Data Bulan 1'].C1.v).toBe(105);
    expect(all['Data Bulan 1'].D1.v).toBe(11);
  });
  it('perubahan di satu sheet merambat ke rumus di sheet lain', () => {
    const wb = newWorkbook();
    writeRows(wb, wb.sheets[0], 'A1', [[1]]);
    const s2 = addSheet(wb, 'Ringkasan');
    writeRows(wb, s2, 'A1', [['=Sheet1!A1*3']]);
    expect(evaluateAll(wb).Ringkasan.A1.v).toBe(3);
    writeRows(wb, wb.sheets[0], 'A1', [[7]]);
    expect(evaluateAll(wb).Ringkasan.A1.v).toBe(21);
  });
});

describe('operasi dan batas', () => {
  it('menimpa sel mempertahankan gaya; mengosongkan nilai menghapus sel tanpa gaya', () => {
    const wb = book([[1, 2]]);
    formatRange(wb, wb.sheets[0], 'A1', { b: true });
    writeRows(wb, wb.sheets[0], 'A1', [[9]]);
    expect(wb.sheets[0].cells.A1).toEqual({ v: 9, s: { b: true } });
    writeRows(wb, wb.sheets[0], 'B1', [[null]]);
    expect(wb.sheets[0].cells.B1).toBeUndefined();
  });
  it('format: validasi warna dan format angka', () => {
    const wb = book([[1]]);
    const s = wb.sheets[0];
    expect(formatRange(wb, s, 'A1:B2', { bg: '#ffeeaa', fmt: '#,##0', a: 'right' })).toHaveLength(4);
    expect(() => formatRange(wb, s, 'A1', { bg: 'merah' })).toThrow(SheetError);
    expect(() => formatRange(wb, s, 'A1', { fmt: '<script>' })).toThrow(SheetError);
    expect(() => formatRange(wb, s, 'A1', {})).toThrow(SheetError);
  });
  it('menolak di luar batas, alamat salah, dan terlalu banyak sel', () => {
    const wb = newWorkbook();
    const s = wb.sheets[0];
    expect(() => writeRows(wb, s, 'ZZZ1', [[1]])).toThrow(/luar batas/);
    expect(() => writeRows(wb, s, `A${LIMITS.MAX_ROWS + 1}`, [[1]])).toThrow(/luar batas/);
    expect(() => writeRows(wb, s, '1A', [[1]])).toThrow(SheetError);
    expect(() => writeRows(wb, s, 'A1', [Array(LIMITS.MAX_WRITE_CELLS + 1).fill(1)])).toThrow(/Terlalu banyak/);
    expect(() => writeRows(wb, s, 'A1', ['bukan-larik' as unknown as unknown[]])).toThrow(SheetError);
    expect(() => writeRows(wb, s, 'A1', [['x'.repeat(LIMITS.MAX_TEXT_LEN + 1)]])).toThrow(/terlalu panjang/);
    expect(() => writeRows(wb, s, 'A1', [['=' + '1+'.repeat(600) + '1']])).toThrow(/Rumus terlalu panjang/);
    expect(() => writeRows(wb, s, 'A1', [[Number.NaN]])).toThrow(SheetError);
  });
  it('sheet: nama unik, valid, dan dibatasi jumlahnya', () => {
    const wb = newWorkbook();
    expect(() => addSheet(wb, 'sheet1')).toThrow(/sudah ada/);
    expect(() => addSheet(wb, 'a/b')).toThrow(SheetError);
    expect(() => addSheet(wb, 'x'.repeat(32))).toThrow(SheetError);
    for (let i = 2; i <= LIMITS.MAX_SHEETS; i++) addSheet(wb, `S${i}`);
    expect(() => addSheet(wb, 'Kelebihan')).toThrow(/Maksimal/);
    expect(findSheet(wb, 'S3').name).toBe('S3');
    expect(() => findSheet(wb, 'tidak-ada')).toThrow(/tidak ditemukan/);
  });
  it('clearRange menghapus nilai dan gaya', () => {
    const wb = book([[1, 2], [3, 4]]);
    expect(clearRange(wb.sheets[0], 'A1:A2')).toEqual(['A1', 'A2']);
    expect(Object.keys(wb.sheets[0].cells).sort()).toEqual(['B1', 'B2']);
  });
});
