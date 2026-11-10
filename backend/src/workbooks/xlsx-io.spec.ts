import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { addSheet, evaluateAll, formatRange, newWorkbook, SheetError, writeRows } from './engine.js';
import { exportXlsx, importXlsx, inspectZip } from './xlsx-io.js';

const xlsx = async (build: (ws: ExcelJS.Worksheet, wb: ExcelJS.Workbook) => void): Promise<Buffer> => {
  const wb = new ExcelJS.Workbook();
  build(wb.addWorksheet('Data'), wb);
  return Buffer.from(await wb.xlsx.writeBuffer());
};

describe('impor .xlsx', () => {
  it('membaca nilai, rumus, gaya, tanggal, dan lebar kolom', async () => {
    const buf = await xlsx((ws) => {
      ws.getCell('A1').value = 'Nama';
      ws.getCell('A1').font = { bold: true, color: { argb: 'FFFF0000' } };
      ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEEAA' } };
      ws.getCell('B1').value = 12500;
      ws.getCell('B1').numFmt = '#,##0';
      ws.getCell('B2').value = { formula: 'B1*2', result: 25000 };
      ws.getCell('C1').value = new Date(Date.UTC(2026, 0, 31));
      ws.getCell('D1').value = { richText: [{ text: 'Rich ' }, { text: 'text' }] };
      ws.getColumn(1).width = 22;
    });
    const { workbook, warnings } = await importXlsx(buf, 'laporan.xlsx');
    const s = workbook.sheets[0];
    expect(workbook.name).toBe('laporan');
    expect(s.cells.A1).toEqual({ v: 'Nama', s: { b: true, color: '#FF0000', bg: '#FFEEAA' } });
    expect(s.cells.B1.s?.fmt).toBe('#,##0');
    expect(s.cells.B2.f).toBe('B1*2');
    expect(s.cells.C1.v).toBeCloseTo(46053, 0); // 2026-01-31 sebagai nomor seri Excel
    expect(s.cells.C1.s?.fmt).toBe('dd/mm/yyyy');
    expect(s.cells.D1.v).toBe('Rich text');
    expect(s.widths.A).toBe(22);
    expect(warnings.some((w) => /Grafik/.test(w))).toBe(true);
    expect(evaluateAll(workbook).Data.B2.v).toBe(25000);
  });

  it('rumus yang tidak didukung mesin memakai nilai tersimpan dari Excel (bukan galat)', async () => {
    const buf = await xlsx((ws) => {
      ws.getCell('A1').value = { formula: 'XLOOKUP(1,B1:B2,C1:C2)', result: 777 };
    });
    const { workbook } = await importXlsx(buf, 'x.xlsx');
    const r = evaluateAll(workbook).Data.A1;
    expect(r.v).toBe(777);
    expect(r.e).toBeUndefined();
    expect(r.m).toMatch(/nilai tersimpan/);
  });

  it('menolak ekstensi selain .xlsx, berkas rusak, dan bukan zip', async () => {
    const ok = await xlsx((ws) => (ws.getCell('A1').value = 1));
    await expect(importXlsx(ok, 'a.xls')).rejects.toThrow(/\.xlsx/);
    await expect(importXlsx(ok, 'a.xlsm')).rejects.toThrow(/\.xlsx/);
    await expect(importXlsx(Buffer.from('bukan zip sama sekali, hanya teks biasa'), 'a.xlsx')).rejects.toThrow(SheetError);
    await expect(importXlsx(ok.subarray(0, 200), 'a.xlsx')).rejects.toThrow(SheetError);
  });

  it('menolak berkas bermakro (vbaProject.bin)', async () => {
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<x/>');
    zip.file('xl/vbaProject.bin', 'MACRO');
    const buf = await zip.generateAsync({ type: 'nodebuffer' });
    expect(() => inspectZip(buf)).toThrow(/makro/);
  });

  it('menolak zip bomb yang mengaku besar', async () => {
    const zip = new JSZip();
    zip.file('a.bin', Buffer.alloc(90 * 1024 * 1024)); // 90 MB nol: menyusut jadi ~90 KB
    const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    expect(buf.length).toBeLessThan(1_000_000);
    expect(() => inspectZip(buf)).toThrow(/terlalu besar/);
  });

  it('menolak zip bomb yang BERBOHONG soal ukuran', async () => {
    const zip = new JSZip();
    zip.file('a.bin', Buffer.alloc(3 * 1024 * 1024));
    const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    // ubah klaim ukuran di central directory menjadi 1000 byte
    const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    const cd = buf.readUInt32LE(eocd + 16);
    buf.writeUInt32LE(1000, cd + 24);
    expect(() => inspectZip(buf)).toThrow(/mencurigakan|rusak/);
  });
});

describe('ekspor .xlsx', () => {
  it('bolak-balik: nilai, rumus (dengan hasil tersimpan), gaya, dan banyak sheet', async () => {
    const wb = newWorkbook('Anggaran');
    const s = wb.sheets[0];
    writeRows(wb, s, 'A1', [['Item', 'Jumlah'], ['Sewa', 24000000], ['Gaji', 50000000], ['Total', '=SUM(B2:B3)']]);
    formatRange(wb, s, 'A1:B1', { b: true, bg: '#DDDDFF' });
    formatRange(wb, s, 'B2:B4', { fmt: '#,##0', a: 'right' });
    const s2 = addSheet(wb, 'Ringkasan');
    writeRows(wb, s2, 'A1', [['=Sheet1!B4*12']]);

    const buf = await exportXlsx(wb, evaluateAll(wb));
    const back = new ExcelJS.Workbook();
    await back.xlsx.load(buf as unknown as ExcelJS.Buffer);
    expect(back.worksheets.map((w) => w.name)).toEqual(['Sheet1', 'Ringkasan']);
    const ws = back.getWorksheet('Sheet1')!;
    expect(ws.getCell('B4').value).toMatchObject({ formula: 'SUM(B2:B3)', result: 74000000 });
    expect(ws.getCell('A1').font?.bold).toBe(true);
    expect(ws.getCell('B2').numFmt).toBe('#,##0');
    expect(back.getWorksheet('Ringkasan')!.getCell('A1').value).toMatchObject({ formula: 'Sheet1!B4*12', result: 888000000 });
  });

  it('IMPOR lalu EKSPOR mempertahankan isi', async () => {
    const buf = await xlsx((ws) => {
      ws.getCell('A1').value = 'Qty';
      ws.getCell('A2').value = 4;
      ws.getCell('A3').value = { formula: 'A2*5', result: 20 };
    });
    const { workbook } = await importXlsx(buf, 'a.xlsx');
    const out = await exportXlsx(workbook, evaluateAll(workbook));
    const again = await importXlsx(out, 'b.xlsx');
    expect(again.workbook.sheets[0].cells.A2.v).toBe(4);
    expect(again.workbook.sheets[0].cells.A3.f).toBe('A2*5');
  });

  it('KEAMANAN: rumus yang tidak dipahami mesin tidak diekspor sebagai rumus (anti suntikan DDE)', async () => {
    const wb = newWorkbook();
    writeRows(wb, wb.sheets[0], 'A1', [["=cmd|' /C calc'!A0", '=HYPERLINK("http://x","klik")', '=SUM(1,2)']]);
    const buf = await exportXlsx(wb, evaluateAll(wb));
    const back = new ExcelJS.Workbook();
    await back.xlsx.load(buf as unknown as ExcelJS.Buffer);
    const ws = back.getWorksheet('Sheet1')!;
    const a1 = ws.getCell('A1').value as unknown;
    const b1 = ws.getCell('B1').value as unknown;
    expect(typeof a1).toBe('string'); // teks biasa, bukan rumus
    expect(typeof b1).toBe('string'); // fungsi tidak didukung -> teks
    expect(ws.getCell('C1').value).toMatchObject({ formula: 'SUM(1,2)', result: 3 });
  });
});
