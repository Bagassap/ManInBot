import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  addSheet,
  boxFrom,
  cellView,
  clearRange,
  evaluateAll,
  findSheet,
  formatRange,
  LIMITS,
  newWorkbook,
  parseRef,
  refOf,
  setWidth,
  SheetError,
  show,
  usedDims,
  writeRows,
  type CellView,
  type ComputedBook,
  type Sheet,
  type Workbook,
} from './engine.js';
import { SHEET_TOOL_NAMES } from './sheet-tools.js';
import { VIEW_COLS, VIEW_ROWS, type SheetEvent, type SheetSnapshot, type ToolCtx } from './types.js';
import { exportXlsx, importXlsx } from './xlsx-io.js';

export interface ToolResult {
  content: string;
  isError?: boolean;
}

const MAX_EVENT_CELLS = 1500;

@Injectable()
export class WorkbooksService {
  constructor(private readonly prisma: PrismaService) {}

  /* ---------- penyimpanan ---------- */
  private async load(conversationId: string) {
    const row = await this.prisma.workbook.findUnique({ where: { conversationId } });
    return row ? { id: row.id, wb: row.data as unknown as Workbook } : null;
  }

  private async save(userId: string, workspaceId: string, conversationId: string, wb: Workbook) {
    const data = wb as unknown as Prisma.InputJsonValue;
    await this.prisma.workbook.upsert({
      where: { conversationId },
      create: { userId, workspaceId, conversationId, name: wb.name, data },
      update: { name: wb.name, data },
    });
  }

  private async assertOwned(workspaceId: string, userId: string, conversationId: string) {
    const conv = await this.prisma.conversation.findFirst({ where: { id: conversationId, userId, workspaceId }, select: { id: true } });
    if (!conv) throw new NotFoundException('Percakapan tidak ditemukan');
  }

  /* ---------- tampilan ---------- */
  snapshot(wb: Workbook, computed: ComputedBook = evaluateAll(wb), active?: string, warnings?: string[]): SheetSnapshot {
    return {
      name: wb.name,
      active: active ?? wb.sheets[0].name,
      warnings,
      sheets: wb.sheets.map((s) => {
        const dims = usedDims(s);
        const cells: Record<string, CellView> = {};
        for (const [ref, cell] of Object.entries(s.cells)) {
          const p = parseRef(ref)!;
          if (p.row <= VIEW_ROWS && p.col <= VIEW_COLS) cells[ref] = cellView(cell, computed[s.name]?.[ref]);
        }
        return { name: s.name, rows: dims.rows, cols: dims.cols, truncated: dims.rows > VIEW_ROWS || dims.cols > VIEW_COLS, widths: s.widths, cells };
      }),
    };
  }

  async getSnapshot(workspaceId: string, userId: string, conversationId: string): Promise<SheetSnapshot | null> {
    await this.assertOwned(workspaceId, userId, conversationId);
    const loaded = await this.load(conversationId);
    return loaded ? this.snapshot(loaded.wb) : null;
  }

  /* ---------- impor / ekspor ---------- */
  async importFile(workspaceId: string, userId: string, conversationId: string, buffer: Buffer, fileName: string): Promise<SheetSnapshot> {
    await this.assertOwned(workspaceId, userId, conversationId);
    try {
      const { workbook, warnings } = await importXlsx(buffer, fileName);
      await this.save(userId, workspaceId, conversationId, workbook);
      return this.snapshot(workbook, undefined, undefined, warnings);
    } catch (err) {
      if (err instanceof SheetError) throw new BadRequestException(err.message);
      throw err;
    }
  }

  async exportFile(workspaceId: string, userId: string, conversationId: string): Promise<{ buffer: Buffer; name: string }> {
    await this.assertOwned(workspaceId, userId, conversationId);
    const loaded = await this.load(conversationId);
    if (!loaded) throw new NotFoundException('Belum ada lembar kerja di percakapan ini');
    return { buffer: await exportXlsx(loaded.wb, evaluateAll(loaded.wb)), name: loaded.wb.name };
  }

  /* ---------- peristiwa untuk layar bersama ---------- */
  private patchEvents(wb: Workbook, before: ComputedBook, after: ComputedBook, focus: Sheet, touched: string[], wasNew: boolean): SheetEvent[] {
    const events: SheetEvent[] = [];
    const names = wb.sheets.map((s) => s.name);
    let total = 0;
    const per: { sheet: Sheet; cells: Record<string, CellView | null>; touched: string[] }[] = [];

    for (const sheet of wb.sheets) {
      const isFocus = sheet.name === focus.name;
      const cells: Record<string, CellView | null> = {};
      const refs = new Set<string>(isFocus ? touched : []);
      for (const ref of new Set([...Object.keys(before[sheet.name] ?? {}), ...Object.keys(after[sheet.name] ?? {})])) {
        const a = before[sheet.name]?.[ref];
        const b = after[sheet.name]?.[ref];
        if (a?.v !== b?.v || a?.e !== b?.e) refs.add(ref);
      }
      for (const ref of refs) {
        const p = parseRef(ref)!;
        if (p.row > VIEW_ROWS || p.col > VIEW_COLS) continue;
        cells[ref] = sheet.cells[ref] ? cellView(sheet.cells[ref], after[sheet.name]?.[ref]) : null;
      }
      total += Object.keys(cells).length;
      if (Object.keys(cells).length || (isFocus && wasNew)) per.push({ sheet, cells, touched: isFocus ? touched.filter((r) => r in cells) : [] });
    }

    // Terlalu banyak perubahan: kirim potret penuh agar layar pasti sinkron.
    if (total > MAX_EVENT_CELLS) return [{ type: 'sheet_reset', snapshot: this.snapshot(wb, after, focus.name) }];

    for (const { sheet, cells, touched: t } of per) {
      const dims = usedDims(sheet);
      events.push({ type: 'sheet_patch', workbook: wb.name, sheet: sheet.name, sheets: names, cells, touched: t, rows: dims.rows, cols: dims.cols, focus: sheet.name === focus.name });
    }
    return events;
  }

  /* ---------- alat agen ---------- */
  isSheetTool = (name: string) => SHEET_TOOL_NAMES.has(name);

  async runTool(name: string, input: unknown, ctx: ToolCtx): Promise<ToolResult> {
    const a = (input ?? {}) as Record<string, unknown>;
    const str = (k: string) => (typeof a[k] === 'string' ? (a[k] as string) : undefined);
    try {
      const loaded = await this.load(ctx.conversationId);
      const wb = loaded?.wb ?? newWorkbook();
      const wasNew = !loaded;

      if (name === 'sheet_info') {
        const computed = evaluateAll(wb);
        const lines = wb.sheets.map((s) => {
          const d = usedDims(s);
          const cs = Object.entries(s.cells);
          const formulas = cs.filter(([, c]) => c.f !== undefined).length;
          const errors = Object.values(computed[s.name] ?? {}).filter((c) => c.e).length;
          const preview: string[] = [];
          for (let r = 1; r <= Math.min(3, d.rows); r++) {
            const cellsOfRow: string[] = [];
            for (let c = 1; c <= Math.min(10, d.cols); c++) {
              const ref = refOf(c, r);
              if (s.cells[ref]) cellsOfRow.push(`${ref}=${show(computed[s.name]?.[ref])}`);
            }
            if (cellsOfRow.length) preview.push(`   ${cellsOfRow.join(' | ')}`);
          }
          return [`- Sheet "${s.name}": ${d.rows} baris x ${d.cols} kolom, ${cs.length} sel berisi, ${formulas} rumus, ${errors} galat.`, ...preview].join('\n');
        });
        return { content: `Lembar kerja "${wb.name}"${wasNew ? ' (masih kosong)' : ''}:\n${lines.join('\n')}` };
      }

      const sheetName = str('sheet');

      if (name === 'sheet_read') {
        const sheet = findSheet(wb, sheetName);
        const box = boxFrom(str('range') ?? '');
        const computed = evaluateAll(wb)[sheet.name] ?? {};
        const rows: string[] = [];
        let count = 0;
        let more = false;
        outer: for (let r = box.r1; r <= box.r2; r++) {
          const parts: string[] = [];
          for (let c = box.c1; c <= box.c2; c++) {
            const ref = refOf(c, r);
            const cell = sheet.cells[ref];
            if (!cell || (cell.v === undefined && cell.f === undefined)) continue;
            if (++count > LIMITS.MAX_READ_CELLS) {
              more = true;
              break outer;
            }
            parts.push(cell.f !== undefined ? `${ref}==${cell.f} -> ${show(computed[ref])}` : `${ref}=${show(computed[ref])}`);
          }
          if (parts.length) rows.push(parts.join(' | '));
        }
        const head = `${sheet.name}!${str('range')}: ${Math.min(count, LIMITS.MAX_READ_CELLS)} sel berisi${more ? ` (dipotong di ${LIMITS.MAX_READ_CELLS}; baca rentang lebih kecil untuk sisanya)` : ''}`;
        return { content: rows.length ? `${head}\n${rows.join('\n')}` : `${head}\n(kosong)` };
      }

      // ---- alat yang mengubah lembar kerja ----
      const before = evaluateAll(wb);
      let focus: Sheet;
      let touched: string[] = [];
      let summary: string;

      if (name === 'sheet_add') {
        focus = addSheet(wb, str('name') ?? '');
        summary = `Sheet "${focus.name}" ditambahkan.`;
      } else if (name === 'sheet_write') {
        focus = findSheet(wb, sheetName);
        touched = writeRows(wb, focus, str('start') ?? '', a.rows as unknown[][]);
        const after = evaluateAll(wb);
        const results: string[] = [];
        const problems: string[] = [];
        for (const ref of touched) {
          if (focus.cells[ref]?.f === undefined) continue;
          const c = after[focus.name]?.[ref];
          if (c?.e) problems.push(`${ref}=${c.e}${c.m ? ` (${c.m})` : ''}`);
          else if (results.length < 25) results.push(`${ref}=${show(c)}`);
        }
        summary = `Menulis ${touched.length} sel di ${focus.name}!${touched[0]}:${touched[touched.length - 1]}.`;
        if (results.length) summary += ` Hasil rumus: ${results.join(', ')}.`;
        if (problems.length) summary += ` PERIKSA GALAT: ${problems.join(', ')}. Perbaiki rumusnya.`;
      } else if (name === 'sheet_format') {
        focus = findSheet(wb, sheetName);
        touched = formatRange(wb, focus, str('range') ?? '', {
          b: typeof a.bold === 'boolean' ? a.bold : undefined,
          bg: str('background'),
          color: str('color'),
          fmt: str('number_format'),
          a: str('align') as 'left' | 'center' | 'right' | undefined,
        });
        summary = `Memformat ${touched.length} sel di ${focus.name}!${str('range')}.`;
      } else if (name === 'sheet_width') {
        focus = findSheet(wb, sheetName);
        setWidth(focus, str('column') ?? '', Number(a.width));
        summary = `Lebar kolom ${(str('column') ?? '').toUpperCase()} diatur.`;
      } else if (name === 'sheet_clear') {
        focus = findSheet(wb, sheetName);
        touched = clearRange(focus, str('range') ?? '');
        summary = `Mengosongkan ${touched.length} sel di ${focus.name}!${str('range')}.`;
      } else {
        return { content: `Alat tidak dikenal: ${name}`, isError: true };
      }

      await this.save(ctx.userId, ctx.workspaceId, ctx.conversationId, wb);
      const after = evaluateAll(wb);
      for (const e of this.patchEvents(wb, before, after, focus, touched, name === 'sheet_add' || wasNew)) ctx.emit(e);
      return { content: summary };
    } catch (err) {
      if (err instanceof SheetError) return { content: err.message, isError: true };
      throw err;
    }
  }
}
