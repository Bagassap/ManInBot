/** Bentuk data lembar kerja yang dialirkan backend ke layar bersama, plus pemformat tampilannya. */

export type CellValue = string | number | boolean | null;

export interface CellStyle {
  b?: boolean;
  bg?: string;
  color?: string;
  fmt?: string;
  a?: "left" | "center" | "right";
}

export interface CellView {
  v?: CellValue;
  f?: string;
  e?: string;
  s?: CellStyle;
}

export interface SheetData {
  rows: number;
  cols: number;
  truncated: boolean;
  widths: Record<string, number>;
  cells: Record<string, CellView>;
}

export interface SnapshotSheet extends SheetData {
  name: string;
}

export interface SheetSnapshot {
  name: string;
  sheets: SnapshotSheet[];
  active: string;
  warnings?: string[];
}

export type SheetEventPatch = {
  type: "sheet_patch";
  workbook: string;
  sheet: string;
  sheets: string[];
  cells: Record<string, CellView | null>;
  touched: string[];
  rows: number;
  cols: number;
  focus: boolean;
};

export interface SheetState {
  name: string;
  order: string[];
  sheets: Record<string, SheetData>;
  active: string;
  warnings: string[];
  /** Naik setiap kali agen menyentuh sel: dipakai memicu animasi dan perpindahan tab. */
  seq: number;
  /** Sel yang baru disentuh beserta urutannya (untuk animasi mengisi satu per satu). */
  touch: { sheet: string; order: Record<string, number> } | null;
}

export const emptySheetData = (): SheetData => ({
  rows: 0,
  cols: 0,
  truncated: false,
  widths: {},
  cells: {},
});

export function fromSnapshot(snap: SheetSnapshot, prevSeq: number): SheetState {
  const sheets: Record<string, SheetData> = {};
  for (const s of snap.sheets) {
    const { name: _n, ...rest } = s;
    void _n;
    sheets[s.name] = rest;
  }
  return {
    name: snap.name,
    order: snap.sheets.map((s) => s.name),
    sheets,
    active: snap.active,
    warnings: snap.warnings ?? [],
    seq: prevSeq + 1,
    touch: null,
  };
}

export function applyPatch(
  prev: SheetState | null,
  p: SheetEventPatch,
): SheetState {
  const base: SheetState = prev ?? {
    name: p.workbook,
    order: [],
    sheets: {},
    active: p.sheet,
    warnings: [],
    seq: 0,
    touch: null,
  };
  const cur = base.sheets[p.sheet] ?? emptySheetData();
  const cells = { ...cur.cells };
  for (const [ref, view] of Object.entries(p.cells)) {
    if (view === null) delete cells[ref];
    else cells[ref] = view;
  }
  const sheets = {
    ...base.sheets,
    [p.sheet]: { ...cur, cells, rows: p.rows, cols: p.cols },
  };
  const order: Record<string, number> = {};
  p.touched.forEach((ref, i) => {
    order[ref] = i;
  });
  return {
    ...base,
    name: p.workbook,
    sheets,
    order: p.sheets,
    active: p.focus ? p.sheet : base.active,
    seq: base.seq + 1,
    touch: { sheet: p.sheet, order },
  };
}

/* ---------- alamat sel ---------- */
export function colLetters(col: number): string {
  let n = col;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function parseRef(ref: string): { col: number; row: number } | null {
  const m = /^([A-Z]{1,3})(\d{1,5})$/.exec(ref);
  if (!m) return null;
  let col = 0;
  for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { col, row: Number(m[2]) };
}

/* ---------- format tampilan ---------- */
const nf = (decimals: number, grouping: boolean) =>
  new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: grouping,
  });

function serialToDate(serial: number): Date {
  return new Date(Date.UTC(1899, 11, 30) + Math.round(serial * 86400000));
}

function formatDate(serial: number, fmt: string): string {
  const d = serialToDate(serial);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return fmt
    .replace(/yyyy/gi, pad(d.getUTCFullYear(), 4))
    .replace(/yy/gi, pad(d.getUTCFullYear() % 100))
    .replace(/dd/gi, pad(d.getUTCDate()))
    .replace(/mm/gi, pad(d.getUTCMonth() + 1));
}

/** Menampilkan nilai sel sesuai format angka (#,##0 / 0.00 / 0% / Rp #,##0 / dd/mm/yyyy). */
export function formatValue(view: CellView | undefined): string {
  if (!view) return "";
  if (view.e) return view.e;
  const v = view.v;
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "string") return v;
  const fmt = view.s?.fmt;
  if (!fmt || fmt.toLowerCase() === "general")
    return String(Number(v.toPrecision(12)));
  if (/[dy]/i.test(fmt) && !/[#0]/.test(fmt)) return formatDate(v, fmt);

  const m = /^(.*?)([#0][#0,]*(?:\.[0#]+)?)(%?)(.*)$/.exec(fmt);
  if (!m) return String(Number(v.toPrecision(12)));
  const [, prefix, body, pct, suffix] = m;
  const decimals = (body.split(".")[1] ?? "").replace(/#/g, "").length;
  const num = pct ? v * 100 : v;
  return `${prefix}${nf(decimals, body.includes(",")).format(num)}${pct}${suffix}`;
}

export const isNumeric = (view: CellView | undefined) =>
  typeof view?.v === "number" && !view.e;
