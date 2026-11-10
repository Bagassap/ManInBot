import FormulaParser, { type FnArg } from 'fast-formula-parser';

// Paket ini CommonJS: Node ESM hanya mengenali default export, jadi kelasnya diambil dari sana.
const FormulaError = FormulaParser.FormulaError;
type FormulaError = InstanceType<typeof FormulaParser.FormulaError>;

/* ===================== Batas ===================== */
export const LIMITS = {
  MAX_ROWS: 2000,
  MAX_COLS: 60,
  MAX_CELLS: 50_000,
  MAX_SHEETS: 10,
  MAX_WRITE_CELLS: 400,
  MAX_READ_CELLS: 300,
  MAX_FORMAT_CELLS: 5000,
  MAX_FORMULA_LEN: 1000,
  MAX_TEXT_LEN: 2000,
  MAX_DEPTH: 400,
  MAX_RANGE_CELLS: 100_000,
} as const;

/* ===================== Model ===================== */
export type CellValue = number | string | boolean | null;

export interface CellStyle {
  b?: boolean;
  bg?: string;
  color?: string;
  fmt?: string;
  a?: 'left' | 'center' | 'right';
}

/**
 * Sel menyimpan nilai literal (`v`) ATAU rumus (`f`, tanpa tanda "="). Nilai rumus dihitung saat dibaca.
 * Sel hasil impor dari Excel boleh memuat keduanya: `v` = nilai tersimpan, dipakai bila rumusnya tidak didukung mesin.
 */
export interface Cell {
  v?: CellValue;
  f?: string;
  s?: CellStyle;
}

export interface Sheet {
  name: string;
  cells: Record<string, Cell>;
  widths: Record<string, number>;
}

export interface Workbook {
  name: string;
  sheets: Sheet[];
}

export interface Computed {
  v: CellValue;
  e?: string;
  /** Pesan galat singkat (untuk agen), bukan untuk tampilan. */
  m?: string;
}

export type ComputedBook = Record<string, Record<string, Computed>>;

export class SheetError extends Error {}

/* ===================== Alamat sel ===================== */
export function colToLetters(col: number): string {
  let s = '';
  for (let n = col; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

export function lettersToCol(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

export const refOf = (col: number, row: number) => `${colToLetters(col)}${row}`;

export function parseRef(ref: string): { col: number; row: number } | null {
  const m = /^\$?([A-Za-z]{1,3})\$?(\d{1,7})$/.exec(ref.trim());
  if (!m) return null;
  return { col: lettersToCol(m[1]), row: Number(m[2]) };
}

export interface RangeBox {
  c1: number;
  r1: number;
  c2: number;
  r2: number;
}

/** "A1" atau "A1:C5" -> kotak; null bila tidak valid. */
export function parseRange(text: string): RangeBox | null {
  const [a, b] = text.split(':');
  const p1 = parseRef(a ?? '');
  const p2 = b === undefined ? p1 : parseRef(b);
  if (!p1 || !p2) return null;
  return { c1: Math.min(p1.col, p2.col), r1: Math.min(p1.row, p2.row), c2: Math.max(p1.col, p2.col), r2: Math.max(p1.row, p2.row) };
}

function assertBounds(col: number, row: number, ref: string) {
  if (col < 1 || row < 1 || col > LIMITS.MAX_COLS || row > LIMITS.MAX_ROWS) {
    throw new SheetError(`Sel ${ref} di luar batas (maks. kolom ${colToLetters(LIMITS.MAX_COLS)}, baris ${LIMITS.MAX_ROWS})`);
  }
}

/* ===================== Fungsi tambahan ===================== */
/** Mengumpulkan semua nilai dari argumen (rentang 2D maupun skalar) menjadi daftar datar. */
const flat = (args: FnArg[]): unknown[] => args.flatMap((a) => (Array.isArray(a.value) ? (a.value as unknown[]).flat(Infinity) : [a.value]));
const nums = (args: FnArg[]): number[] => flat(args).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
const scalar = (a: FnArg | undefined): unknown => (Array.isArray(a?.value) ? (a!.value as unknown[][])[0]?.[0] : a?.value);
const asNumber = (v: unknown): number | null => (typeof v === 'number' ? v : typeof v === 'boolean' ? Number(v) : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);

/** Kriteria gaya Excel untuk SUMIFS/COUNTIFS: angka, ">=10", "<>x", "a*" (wildcard). */
function matchesCriteria(value: unknown, crit: unknown): boolean {
  if (typeof crit === 'number' || typeof crit === 'boolean') return typeof value === 'number' ? value === Number(crit) : String(value).toLowerCase() === String(crit).toLowerCase();
  const text = String(crit ?? '');
  const m = /^(>=|<=|<>|>|<|=)?(.*)$/s.exec(text)!;
  const op = m[1] ?? '=';
  const operand = m[2];
  const on = asNumber(operand);
  if (on !== null && (op !== '=' && op !== '<>' ? true : typeof value === 'number')) {
    const vn = asNumber(value);
    if (vn === null) return op === '<>';
    return op === '>' ? vn > on : op === '<' ? vn < on : op === '>=' ? vn >= on : op === '<=' ? vn <= on : op === '<>' ? vn !== on : vn === on;
  }
  const re = new RegExp(`^${operand.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')}$`, 'i');
  const hit = re.test(String(value ?? ''));
  return op === '<>' ? !hit : hit;
}

function multiCriteria(args: FnArg[], start: number): ((i: number) => boolean) | FormulaError {
  const pairs: { range: unknown[]; crit: unknown }[] = [];
  for (let i = start; i + 1 < args.length; i += 2) pairs.push({ range: flat([args[i]]), crit: scalar(args[i + 1]) });
  if (pairs.length === 0) return FormulaError.VALUE;
  const len = pairs[0].range.length;
  if (pairs.some((p) => p.range.length !== len)) return FormulaError.VALUE;
  return (i) => pairs.every((p) => matchesCriteria(p.range[i], p.crit));
}

const CUSTOM_FUNCTIONS: Record<string, (...args: FnArg[]) => unknown> = {
  MAX: (...a) => {
    const n = nums(a);
    return n.length ? Math.max(...n) : 0;
  },
  MIN: (...a) => {
    const n = nums(a);
    return n.length ? Math.min(...n) : 0;
  },
  COUNTA: (...a) => flat(a).filter((v) => v !== null && v !== undefined && v !== '').length,
  MEDIAN: (...a) => {
    const n = nums(a).sort((x, y) => x - y);
    if (!n.length) return FormulaError.NUM;
    const mid = Math.floor(n.length / 2);
    return n.length % 2 ? n[mid] : (n[mid - 1] + n[mid]) / 2;
  },
  LARGE: (range, k) => {
    const n = nums([range]).sort((x, y) => y - x);
    const i = asNumber(scalar(k));
    return i !== null && i >= 1 && i <= n.length ? n[Math.floor(i) - 1] : FormulaError.NUM;
  },
  SMALL: (range, k) => {
    const n = nums([range]).sort((x, y) => x - y);
    const i = asNumber(scalar(k));
    return i !== null && i >= 1 && i <= n.length ? n[Math.floor(i) - 1] : FormulaError.NUM;
  },
  LEN: (t) => String(scalar(t) ?? '').length,
  UPPER: (t) => String(scalar(t) ?? '').toUpperCase(),
  SUBSTITUTE: (t, from, to, nth) => {
    const text = String(scalar(t) ?? '');
    const f = String(scalar(from) ?? '');
    const r = String(scalar(to) ?? '');
    if (!f) return text;
    const n = nth ? asNumber(scalar(nth)) : null;
    if (n === null) return text.split(f).join(r);
    let count = 0;
    let at = -1;
    for (let i = text.indexOf(f); i !== -1; i = text.indexOf(f, i + f.length)) if (++count === n) at = i;
    return at < 0 ? text : text.slice(0, at) + r + text.slice(at + f.length);
  },
  VALUE: (t) => {
    const v = scalar(t);
    if (typeof v === 'number') return v;
    const n = asNumber(String(v ?? '').replace(/,/g, ''));
    return n === null ? FormulaError.VALUE : n;
  },
  MATCH: (lookup, range, type) => {
    const key = scalar(lookup);
    const list = flat([range]);
    const t = type ? (asNumber(scalar(type)) ?? 1) : 1;
    const eq = (a: unknown, b: unknown) => (typeof a === 'string' && typeof b === 'string' ? a.toLowerCase() === b.toLowerCase() : a === b);
    if (t === 0) {
      const i = list.findIndex((v) => eq(v, key));
      return i < 0 ? FormulaError.NA : i + 1;
    }
    const kn = asNumber(key);
    if (kn === null) return FormulaError.NA;
    let best = -1;
    list.forEach((v, i) => {
      const vn = typeof v === 'number' ? v : null;
      if (vn === null) return;
      if (t > 0 ? vn <= kn : vn >= kn) {
        if (best < 0 || (t > 0 ? vn >= (list[best] as number) : vn <= (list[best] as number))) best = i;
      }
    });
    return best < 0 ? FormulaError.NA : best + 1;
  },
  SUMIFS: (sumRange, ...rest) => {
    const test = multiCriteria([sumRange, ...rest], 1);
    if (test instanceof FormulaError) return test;
    const sums = flat([sumRange]);
    return sums.reduce<number>((acc, v, i) => (typeof v === 'number' && test(i) ? acc + v : acc), 0);
  },
  COUNTIFS: (...a) => {
    const test = multiCriteria(a, 0);
    if (test instanceof FormulaError) return test;
    const n = flat([a[0]]).length;
    let c = 0;
    for (let i = 0; i < n; i++) if (test(i)) c++;
    return c;
  },
};

/** Daftar fungsi yang bisa dipakai di rumus (untuk deskripsi alat agen). */
export const FORMULA_HELP =
  'SUM, AVERAGE, MIN, MAX, COUNT, COUNTA, MEDIAN, LARGE, SMALL, SUMIF, SUMIFS, COUNTIF, COUNTIFS, AVERAGEIF, IF, IFERROR, AND, OR, NOT, ROUND, ROUNDUP, ROUNDDOWN, ABS, SQRT, POWER, MOD, INT, SUMPRODUCT, VLOOKUP, HLOOKUP, INDEX, MATCH, LEFT, RIGHT, MID, LEN, UPPER, LOWER, TRIM, CONCATENATE, SUBSTITUTE, TEXT, VALUE, DATE, YEAR, MONTH, DAY, TODAY, FIND, ISBLANK, ISNUMBER';

/* ===================== Evaluator ===================== */
const toError = (e: unknown): FormulaError => (e instanceof FormulaError ? e : new FormulaError('#VALUE!'));

export class Evaluator {
  private cache = new Map<string, Computed>();
  private visiting = new Set<string>();
  private depth = 0;
  private readonly parser: FormulaParser;

  constructor(private readonly wb: Workbook) {
    this.parser = new FormulaParser({
      onCell: ({ sheet, row, col }) => {
        const c = this.compute(sheet, refOf(col, row));
        return c.e ? new FormulaError(c.e) : c.v;
      },
      onRange: ({ sheet, from, to }) => {
        if ((to.row - from.row + 1) * (to.col - from.col + 1) > LIMITS.MAX_RANGE_CELLS) return FormulaError.REF;
        const out: unknown[][] = [];
        for (let r = from.row; r <= to.row; r++) {
          const row: unknown[] = [];
          for (let c = from.col; c <= to.col; c++) {
            const v = this.compute(sheet, refOf(c, r));
            row.push(v.e ? new FormulaError(v.e) : v.v);
          }
          out.push(row);
        }
        return out;
      },
      functions: CUSTOM_FUNCTIONS,
    });
  }

  compute(sheetName: string, ref: string): Computed {
    const key = `${sheetName.toLowerCase()}!${ref}`;
    const hit = this.cache.get(key);
    if (hit) return hit;

    const sheet = this.wb.sheets.find((s) => s.name.toLowerCase() === sheetName.toLowerCase());
    if (!sheet) return { v: null, e: '#REF!' };
    const cell = sheet.cells[ref];
    if (!cell) return { v: null };
    if (cell.f === undefined) return { v: cell.v ?? null };

    if (this.visiting.has(key)) return { v: null, e: '#CIRC!', m: 'Referensi melingkar' };
    if (this.depth >= LIMITS.MAX_DEPTH) return { v: null, e: '#REF!', m: 'Rantai rumus terlalu dalam' };

    const pos = parseRef(ref)!;
    this.visiting.add(key);
    this.depth++;
    let result: Computed;
    try {
      result = this.normalize(this.parser.parse(cell.f, { sheet: sheet.name, row: pos.row, col: pos.col }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result = /not implemented/i.test(msg)
        ? { v: null, e: '#NAME?', m: `Fungsi tidak didukung: ${(/Function (\w+)/.exec(msg) ?? [])[1] ?? ''}`.trim() }
        : { v: null, e: '#ERROR!', m: 'Rumus tidak valid (kesalahan penulisan)' };
    } finally {
      this.visiting.delete(key);
      this.depth--;
    }
    // Rumus dari Excel yang tidak didukung mesin: tampilkan nilai tersimpannya, bukan galat.
    if ((result.e === '#NAME?' || result.e === '#ERROR!') && cell.v !== undefined) {
      result = { v: cell.v, m: `${result.m ?? 'Rumus tidak didukung'}; menampilkan nilai tersimpan dari Excel` };
    }
    this.cache.set(key, result);
    return result;
  }

  private normalize(raw: unknown): Computed {
    let v: unknown = raw;
    if (Array.isArray(v)) v = (v as unknown[][])[0]?.[0];
    if (v instanceof Error) return { v: null, e: (v as FormulaError).error ?? '#VALUE!' };
    if (typeof v === 'number') return Number.isFinite(v) ? { v: Number(v.toPrecision(15)) } : { v: null, e: '#NUM!' };
    if (typeof v === 'string' || typeof v === 'boolean') return { v };
    return { v: null };
  }
}

export function evaluateAll(wb: Workbook): ComputedBook {
  const ev = new Evaluator(wb);
  const out: ComputedBook = {};
  for (const sheet of wb.sheets) {
    const m: Record<string, Computed> = {};
    for (const ref of Object.keys(sheet.cells)) m[ref] = ev.compute(sheet.name, ref);
    out[sheet.name] = m;
  }
  return out;
}

/* ===================== Operasi ===================== */
export function newWorkbook(name = 'Lembar kerja'): Workbook {
  return { name, sheets: [{ name: 'Sheet1', cells: {}, widths: {} }] };
}

export const countCells = (wb: Workbook) => wb.sheets.reduce((n, s) => n + Object.keys(s.cells).length, 0);

export function findSheet(wb: Workbook, name?: string): Sheet {
  if (!name) return wb.sheets[0];
  const s = wb.sheets.find((x) => x.name.toLowerCase() === name.trim().toLowerCase());
  if (!s) throw new SheetError(`Sheet "${name}" tidak ditemukan. Sheet yang ada: ${wb.sheets.map((x) => x.name).join(', ')}`);
  return s;
}

export function addSheet(wb: Workbook, rawName: string): Sheet {
  const name = rawName.trim();
  if (!name || name.length > 31 || /[[\]:*?/\\]/.test(name)) throw new SheetError('Nama sheet 1-31 karakter dan tidak boleh memuat [ ] : * ? / \\');
  if (wb.sheets.some((s) => s.name.toLowerCase() === name.toLowerCase())) throw new SheetError(`Sheet "${name}" sudah ada`);
  if (wb.sheets.length >= LIMITS.MAX_SHEETS) throw new SheetError(`Maksimal ${LIMITS.MAX_SHEETS} sheet`);
  const sheet: Sheet = { name, cells: {}, widths: {} };
  wb.sheets.push(sheet);
  return sheet;
}

function toCell(value: unknown, prev: Cell | undefined): Cell | null {
  const s = prev?.s;
  const keep = (c: Cell): Cell | null => (c.v === undefined && c.f === undefined && !c.s ? null : c);
  if (value === null || value === undefined || value === '') return keep({ s });
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new SheetError('Angka tidak valid (NaN/Infinity)');
    return keep({ v: value, s });
  }
  if (typeof value === 'boolean') return keep({ v: value, s });
  const text = String(value);
  if (text.length > LIMITS.MAX_TEXT_LEN) throw new SheetError(`Teks terlalu panjang (maks. ${LIMITS.MAX_TEXT_LEN} karakter)`);
  if (text.startsWith('=') && text.length > 1) {
    if (text.length - 1 > LIMITS.MAX_FORMULA_LEN) throw new SheetError(`Rumus terlalu panjang (maks. ${LIMITS.MAX_FORMULA_LEN} karakter)`);
    return keep({ f: text.slice(1), s });
  }
  return keep({ v: text, s });
}

/** Menulis tabel 2D mulai dari `start`. Mengembalikan daftar sel yang disentuh (urut baris demi baris). */
export function writeRows(wb: Workbook, sheet: Sheet, start: string, rows: unknown[][]): string[] {
  const origin = parseRef(start);
  if (!origin) throw new SheetError(`Alamat awal "${start}" tidak valid (contoh: A1)`);
  if (!Array.isArray(rows) || rows.some((r) => !Array.isArray(r))) throw new SheetError('rows harus berupa larik 2D (larik baris)');
  const total = rows.reduce((n, r) => n + r.length, 0);
  if (total === 0) throw new SheetError('rows kosong');
  if (total > LIMITS.MAX_WRITE_CELLS) throw new SheetError(`Terlalu banyak sel (${total}); maksimal ${LIMITS.MAX_WRITE_CELLS} per penulisan. Pecah menjadi beberapa panggilan.`);
  const widest = Math.max(...rows.map((r) => r.length));
  assertBounds(origin.col + widest - 1, origin.row + rows.length - 1, refOf(origin.col + widest - 1, origin.row + rows.length - 1));

  const touched: string[] = [];
  const next: Record<string, Cell | null> = {};
  rows.forEach((row, ri) =>
    row.forEach((value, ci) => {
      const ref = refOf(origin.col + ci, origin.row + ri);
      next[ref] = toCell(value, sheet.cells[ref]);
      touched.push(ref);
    }),
  );
  const added = Object.entries(next).filter(([ref, c]) => c && !sheet.cells[ref]).length;
  if (countCells(wb) + added > LIMITS.MAX_CELLS) throw new SheetError(`Lembar kerja melebihi batas ${LIMITS.MAX_CELLS} sel`);
  for (const [ref, c] of Object.entries(next)) {
    if (c) sheet.cells[ref] = c;
    else delete sheet.cells[ref];
  }
  return touched;
}

function rangeCells(box: RangeBox, max: number): string[] {
  const n = (box.c2 - box.c1 + 1) * (box.r2 - box.r1 + 1);
  if (n > max) throw new SheetError(`Rentang terlalu besar (${n} sel; maks. ${max})`);
  const out: string[] = [];
  for (let r = box.r1; r <= box.r2; r++) for (let c = box.c1; c <= box.c2; c++) out.push(refOf(c, r));
  return out;
}

export function boxFrom(range: string): RangeBox {
  const box = parseRange(range);
  if (!box) throw new SheetError(`Rentang "${range}" tidak valid (contoh: A1 atau A1:C5)`);
  assertBounds(box.c2, box.r2, refOf(box.c2, box.r2));
  return box;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const FMT = /^[#0,.%\sRpdmyh:/\-A-Za-z"]{1,40}$/;

export function formatRange(wb: Workbook, sheet: Sheet, range: string, style: Partial<CellStyle>): string[] {
  const box = boxFrom(range);
  const s: CellStyle = {};
  if (style.b !== undefined) s.b = !!style.b;
  if (style.bg !== undefined) {
    if (!HEX.test(style.bg)) throw new SheetError('background harus berformat #RRGGBB');
    s.bg = style.bg;
  }
  if (style.color !== undefined) {
    if (!HEX.test(style.color)) throw new SheetError('color harus berformat #RRGGBB');
    s.color = style.color;
  }
  if (style.fmt !== undefined) {
    if (!FMT.test(style.fmt)) throw new SheetError('number_format tidak valid (contoh: #,##0  0.00  0%  dd/mm/yyyy  Rp #,##0)');
    s.fmt = style.fmt;
  }
  if (style.a !== undefined) {
    if (!['left', 'center', 'right'].includes(style.a)) throw new SheetError('align harus left, center, atau right');
    s.a = style.a;
  }
  if (Object.keys(s).length === 0) throw new SheetError('Tidak ada gaya yang diubah');

  const refs = rangeCells(box, LIMITS.MAX_FORMAT_CELLS);
  const added = refs.filter((r) => !sheet.cells[r]).length;
  if (countCells(wb) + added > LIMITS.MAX_CELLS) throw new SheetError(`Lembar kerja melebihi batas ${LIMITS.MAX_CELLS} sel`);
  for (const ref of refs) sheet.cells[ref] = { ...(sheet.cells[ref] ?? {}), s: { ...(sheet.cells[ref]?.s ?? {}), ...s } };
  return refs;
}

export function clearRange(sheet: Sheet, range: string): string[] {
  const refs = rangeCells(boxFrom(range), LIMITS.MAX_FORMAT_CELLS);
  const gone: string[] = [];
  for (const ref of refs) if (sheet.cells[ref]) { delete sheet.cells[ref]; gone.push(ref); }
  return gone;
}

export function setWidth(sheet: Sheet, col: string, chars: number) {
  if (!/^[A-Za-z]{1,3}$/.test(col) || lettersToCol(col) > LIMITS.MAX_COLS) throw new SheetError('Kolom tidak valid');
  sheet.widths[col.toUpperCase()] = Math.min(80, Math.max(4, chars));
}

/* ===================== Tampilan ===================== */
export interface CellView {
  v?: CellValue;
  f?: string;
  e?: string;
  s?: CellStyle;
}

export function cellView(cell: Cell | undefined, c: Computed | undefined): CellView {
  const out: CellView = {};
  if (c && c.v !== null) out.v = c.v;
  if (c?.e) out.e = c.e;
  if (cell?.f !== undefined) out.f = cell.f;
  if (cell?.s) out.s = cell.s;
  return out;
}

export function usedDims(sheet: Sheet): { rows: number; cols: number } {
  let rows = 0;
  let cols = 0;
  for (const ref of Object.keys(sheet.cells)) {
    const p = parseRef(ref)!;
    rows = Math.max(rows, p.row);
    cols = Math.max(cols, p.col);
  }
  return { rows, cols };
}

/** Teks ringkas satu nilai untuk dibaca model. */
export function show(c: Computed | undefined): string {
  if (!c) return '(kosong)';
  if (c.e) return c.e;
  if (c.v === null) return '(kosong)';
  return typeof c.v === 'string' ? JSON.stringify(c.v) : String(c.v);
}
