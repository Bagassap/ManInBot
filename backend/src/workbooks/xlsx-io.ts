import ExcelJS from 'exceljs';
import { inflateRawSync } from 'node:zlib';
import {
  colToLetters,
  LIMITS,
  refOf,
  SheetError,
  type Cell,
  type CellStyle,
  type CellValue,
  type ComputedBook,
  type Sheet,
  type Workbook,
} from './engine.js';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_UNCOMPRESSED = 80 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 500;

/**
 * Memeriksa isi zip SEBELUM diekstrak, supaya file jebakan (zip bomb: kecil di disk, raksasa di memori)
 * dan file bermakro ditolak. Membaca "central directory" langsung dari byte.
 */
export function inspectZip(buf: Buffer): void {
  if (buf.length < 22 || buf.readUInt32LE(0) !== 0x04034b50) throw new SheetError('Bukan berkas .xlsx yang valid');
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new SheetError('Berkas rusak (tidak ditemukan direktori zip)');
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  if (count === 0xffff || off === 0xffffffff) throw new SheetError('Berkas terlalu besar (zip64 tidak didukung)');
  if (count > MAX_ZIP_ENTRIES) throw new SheetError('Berkas memuat terlalu banyak bagian');

  let total = 0;
  const entries: { method: number; csize: number; usize: number; lho: number }[] = [];
  for (let i = 0; i < count; i++) {
    if (off + 46 > buf.length || buf.readUInt32LE(off) !== 0x02014b50) throw new SheetError('Berkas rusak (direktori zip tidak valid)');
    const method = buf.readUInt16LE(off + 10);
    const csize = buf.readUInt32LE(off + 20);
    const size = buf.readUInt32LE(off + 24);
    const lho = buf.readUInt32LE(off + 42);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen);
    if (/vbaProject\.bin$/i.test(name)) throw new SheetError('Berkas bermakro (VBA) tidak diterima demi keamanan');
    if (size === 0xffffffff) throw new SheetError('Berkas terlalu besar');
    total += size;
    if (total > MAX_UNCOMPRESSED) throw new SheetError('Isi berkas setelah dibuka terlalu besar');
    entries.push({ method, csize, usize: size, lho });
    off += 46 + nameLen + extraLen + commentLen;
  }

  // Ukuran di atas hanya KLAIMAN berkas. Ekstrak tiap bagian dengan batas keluaran sesuai klaim, agar
  // berkas yang berbohong soal ukuran (isi sebenarnya meledak) ditolak sebelum menghabiskan memori.
  for (const e of entries) {
    if (e.usize === 0) continue;
    if (e.lho + 30 > buf.length || buf.readUInt32LE(e.lho) !== 0x04034b50) throw new SheetError('Berkas rusak (header bagian tidak valid)');
    const start = e.lho + 30 + buf.readUInt16LE(e.lho + 26) + buf.readUInt16LE(e.lho + 28);
    const data = buf.subarray(start, start + e.csize);
    if (e.method === 0) {
      if (e.csize !== e.usize) throw new SheetError('Berkas rusak (ukuran tidak cocok)');
    } else if (e.method === 8) {
      try {
        inflateRawSync(data, { maxOutputLength: e.usize });
      } catch {
        throw new SheetError('Berkas rusak atau mencurigakan (ukuran isi tidak sesuai)');
      }
    } else {
      throw new SheetError('Metode kompresi tidak didukung');
    }
  }
}

/* ===================== Impor ===================== */
const argbToHex = (argb?: string): string | undefined =>
  argb && /^[0-9a-fA-F]{8}$/.test(argb) ? `#${argb.slice(2)}` : argb && /^[0-9a-fA-F]{6}$/.test(argb) ? `#${argb}` : undefined;

const FMT_OK = /^[#0,.%\sRpdmyh:/\-A-Za-z"]{1,40}$/;
const dateToSerial = (d: Date) => d.getTime() / 86_400_000 + 25569;

function readStyle(cell: ExcelJS.Cell): CellStyle | undefined {
  const s: CellStyle = {};
  if (cell.font?.bold) s.b = true;
  const color = argbToHex(cell.font?.color?.argb);
  if (color && color.toLowerCase() !== '#000000') s.color = color;
  const fill = cell.fill as ExcelJS.FillPattern | undefined;
  if (fill?.type === 'pattern' && fill.pattern === 'solid') {
    const bg = argbToHex((fill.fgColor as { argb?: string } | undefined)?.argb);
    if (bg && bg.toLowerCase() !== '#ffffff') s.bg = bg;
  }
  const h = cell.alignment?.horizontal;
  if (h === 'left' || h === 'center' || h === 'right') s.a = h;
  if (cell.numFmt && cell.numFmt !== 'General' && FMT_OK.test(cell.numFmt)) s.fmt = cell.numFmt;
  return Object.keys(s).length ? s : undefined;
}

function readValue(cell: ExcelJS.Cell): { v?: CellValue; f?: string; isDate?: boolean } | null {
  const raw = cell.value as unknown;
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number' || typeof raw === 'boolean') return { v: raw };
  if (typeof raw === 'string') return raw === '' ? null : { v: raw.slice(0, LIMITS.MAX_TEXT_LEN) };
  if (raw instanceof Date) return { v: dateToSerial(raw), isDate: true };
  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    if ('formula' in o && typeof o.formula === 'string') {
      const result = o.result;
      const cached = typeof result === 'number' || typeof result === 'boolean' || typeof result === 'string' ? (result as CellValue) : undefined;
      return { f: o.formula.slice(0, LIMITS.MAX_FORMULA_LEN), v: cached };
    }
    if ('sharedFormula' in o) {
      const result = o.result;
      return typeof result === 'number' || typeof result === 'string' || typeof result === 'boolean' ? { v: result as CellValue } : null;
    }
    if ('richText' in o && Array.isArray(o.richText)) return { v: (o.richText as { text: string }[]).map((t) => t.text).join('').slice(0, LIMITS.MAX_TEXT_LEN) };
    if ('text' in o && typeof o.text === 'string') return { v: o.text.slice(0, LIMITS.MAX_TEXT_LEN) };
    if ('error' in o && typeof o.error === 'string') return { v: o.error };
  }
  return null;
}

export interface ImportResult {
  workbook: Workbook;
  warnings: string[];
}

export async function importXlsx(buf: Buffer, fileName: string): Promise<ImportResult> {
  if (!/\.xlsx$/i.test(fileName)) throw new SheetError('Hanya berkas .xlsx yang diterima (bukan .xls atau .xlsm)');
  if (buf.length > MAX_UPLOAD_BYTES) throw new SheetError('Berkas terlalu besar (maks. 5 MB)');
  inspectZip(buf);

  const book = new ExcelJS.Workbook();
  try {
    await book.xlsx.load(buf as unknown as ExcelJS.Buffer);
  } catch {
    throw new SheetError('Berkas tidak dapat dibaca. Pastikan ini file .xlsx yang tidak rusak dan tidak diberi kata sandi.');
  }

  const warnings: string[] = [];
  const sheets: Sheet[] = [];
  let total = 0;
  let cut = 0;
  const used = new Set<string>();

  for (const ws of book.worksheets) {
    if (sheets.length >= LIMITS.MAX_SHEETS) {
      warnings.push(`Hanya ${LIMITS.MAX_SHEETS} sheet pertama yang dibaca`);
      break;
    }
    let name = ws.name.replace(/[[\]:*?/\\]/g, '_').slice(0, 31) || `Sheet${sheets.length + 1}`;
    while (used.has(name.toLowerCase())) name = `${name.slice(0, 28)}_${sheets.length + 1}`;
    used.add(name.toLowerCase());

    const sheet: Sheet = { name, cells: {}, widths: {} };
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber > LIMITS.MAX_ROWS) {
        cut++;
        return;
      }
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        if (colNumber > LIMITS.MAX_COLS) {
          cut++;
          return;
        }
        const read = readValue(cell);
        const style = readStyle(cell);
        if (!read && !style) return;
        const c: Cell = {};
        if (read?.f !== undefined) c.f = read.f;
        if (read?.v !== undefined) c.v = read.v;
        if (style) c.s = style;
        // Format tanggal bawaan Excel (mm-dd-yy) mengikuti wilayah pengguna; untuk Indonesia: dd/mm/yyyy.
        if (read?.isDate && (!c.s?.fmt || /^(mm-dd-yy|m\/d\/yy|mm-dd-yyyy)$/i.test(c.s.fmt))) c.s = { ...c.s, fmt: 'dd/mm/yyyy' };
        if (c.v === undefined && c.f === undefined && !c.s) return;
        if (++total > LIMITS.MAX_CELLS) throw new SheetError(`Berkas terlalu besar: melebihi ${LIMITS.MAX_CELLS} sel. Kecilkan datanya atau unggah sebagian saja.`);
        sheet.cells[refOf(colNumber, rowNumber)] = c;
      });
    });
    for (let c = 1; c <= Math.min(ws.columnCount, LIMITS.MAX_COLS); c++) {
      const w = ws.getColumn(c).width;
      if (w) sheet.widths[colToLetters(c)] = Math.min(80, Math.max(4, w));
    }
    const merges = Object.keys((ws.model as { merges?: unknown }).merges ?? {}).length;
    if (merges) warnings.push(`Sheet "${name}": ${merges} sel gabungan (merged) tidak dipertahankan`);
    sheets.push(sheet);
  }
  if (sheets.length === 0) throw new SheetError('Berkas tidak memuat sheet');
  if (cut) warnings.push(`${cut} sel di luar batas (baris > ${LIMITS.MAX_ROWS} atau kolom > ${colToLetters(LIMITS.MAX_COLS)}) tidak dibaca`);
  warnings.push('Grafik, gambar, tabel pivot, dan format bersyarat tidak ikut terbaca');

  return { workbook: { name: fileName.replace(/\.xlsx$/i, '').slice(0, 80) || 'Lembar kerja', sheets }, warnings };
}

/* ===================== Ekspor ===================== */
const toArgb = (hex: string) => `FF${hex.slice(1).toUpperCase()}`;

export async function exportXlsx(wb: Workbook, computed: ComputedBook): Promise<Buffer> {
  const book = new ExcelJS.Workbook();
  book.creator = 'MiB';
  book.created = new Date();

  for (const sheet of wb.sheets) {
    const ws = book.addWorksheet(sheet.name);
    for (const [col, w] of Object.entries(sheet.widths)) ws.getColumn(col).width = w;
    for (const [ref, cell] of Object.entries(sheet.cells)) {
      const out = ws.getCell(ref);
      const c = computed[sheet.name]?.[ref];
      if (cell.f !== undefined) {
        // Rumus hanya diekspor bila berhasil dipahami mesin. Selain itu ditulis sebagai TEKS (bukan rumus),
        // sehingga teks berawalan "=" (mis. suntikan DDE/perintah) tidak pernah dijalankan Excel.
        const parsed = c && c.e !== '#NAME?' && c.e !== '#ERROR!' && !c.m;
        if (parsed) out.value = { formula: cell.f, result: (c.e ? { error: c.e } : (c.v ?? undefined)) as never };
        else out.value = cell.v ?? `=${cell.f}`;
      } else if (cell.v !== undefined && cell.v !== null) {
        out.value = cell.v;
      }
      const s = cell.s;
      if (s) {
        if (s.b || s.color) out.font = { ...(s.b ? { bold: true } : {}), ...(s.color ? { color: { argb: toArgb(s.color) } } : {}) };
        if (s.bg) out.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: toArgb(s.bg) } };
        if (s.fmt) out.numFmt = s.fmt;
        if (s.a) out.alignment = { horizontal: s.a };
      }
    }
  }
  return Buffer.from(await book.xlsx.writeBuffer());
}
