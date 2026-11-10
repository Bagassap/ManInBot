import type { CellView } from './engine.js';

/** Batas tampilan di layar bersama (data lengkap tetap tersimpan dan bisa dibaca agen lewat sheet_read). */
export const VIEW_ROWS = 300;
export const VIEW_COLS = 40;

export interface SheetSnapshotSheet {
  name: string;
  /** Ukuran area terpakai sebenarnya (bisa lebih besar dari yang ditampilkan). */
  rows: number;
  cols: number;
  truncated: boolean;
  widths: Record<string, number>;
  cells: Record<string, CellView>;
}

export interface SheetSnapshot {
  name: string;
  sheets: SheetSnapshotSheet[];
  active: string;
  warnings?: string[];
}

/** Kejadian yang dialirkan ke layar bersama saat agen mengerjakan lembar kerja. */
export type SheetEvent =
  | { type: 'sheet_reset'; snapshot: SheetSnapshot }
  | {
      type: 'sheet_patch';
      workbook: string;
      sheet: string;
      sheets: string[];
      /** null = sel dikosongkan. */
      cells: Record<string, CellView | null>;
      /** Urutan sel yang disentuh langsung (untuk animasi mengisi satu per satu). */
      touched: string[];
      rows: number;
      cols: number;
      /** Hanya sheet yang sedang dikerjakan agen yang membuat tampilan berpindah. */
      focus: boolean;
    };

export interface ToolCtx {
  userId: string;
  workspaceId: string;
  conversationId: string;
  emit: (e: SheetEvent) => void;
}
