import type { CellView } from './engine.js';

export const VIEW_ROWS = 300;
export const VIEW_COLS = 40;

export interface SheetSnapshotSheet {
  name: string;
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

export type SheetEvent =
  | { type: 'sheet_reset'; snapshot: SheetSnapshot }
  | {
      type: 'sheet_patch';
      workbook: string;
      sheet: string;
      sheets: string[];
      cells: Record<string, CellView | null>;
      touched: string[];
      rows: number;
      cols: number;
      focus: boolean;
    };

export interface ToolCtx {
  userId: string;
  workspaceId: string;
  conversationId: string;
  emit: (e: SheetEvent) => void;
}
