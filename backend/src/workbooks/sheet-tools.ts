import type Anthropic from '@anthropic-ai/sdk';
import { FORMULA_HELP, LIMITS } from './engine.js';

const sheetProp = { type: 'string', description: 'Nama sheet. Kosong = sheet pertama.' } as const;

/** Alat lembar kerja Excel (Excel di chat). */
export const sheetToolDefinitions: Anthropic.Tool[] = [
  {
    name: 'sheet_info',
    description:
      'Melihat isi lembar kerja Excel yang sedang terbuka di layar bersama (nama sheet, ukuran, dan cuplikan baris awal). Panggil ini PERTAMA bila pengguna menyebut file Excel atau tabel yang sudah ada.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'sheet_read',
    description: `Membaca sel pada suatu rentang beserta rumus dan nilainya. Maksimal ${LIMITS.MAX_READ_CELLS} sel berisi per panggilan; baca bagian demi bagian untuk data besar.`,
    input_schema: {
      type: 'object',
      properties: { sheet: sheetProp, range: { type: 'string', description: 'Mis. "A1:F20" atau "B2".' } },
      required: ['range'],
    },
  },
  {
    name: 'sheet_write',
    description: `Menulis tabel ke lembar kerja mulai dari sel "start". Pengguna melihat sel terisi satu per satu di layar bersama. "rows" adalah larik 2D (larik baris). Angka tulis sebagai number, teks sebagai string, dan RUMUS sebagai string berawalan "=" (mis. "=SUM(B2:B10)"). Prioritaskan rumus daripada angka hasil hitung agar lembar kerja tetap hidup. null mengosongkan sel. Maksimal ${LIMITS.MAX_WRITE_CELLS} sel per panggilan. Fungsi yang didukung: ${FORMULA_HELP}. Fungsi lain menghasilkan #NAME?.`,
    input_schema: {
      type: 'object',
      properties: {
        sheet: sheetProp,
        start: { type: 'string', description: 'Sel awal, mis. "A1".' },
        rows: {
          type: 'array',
          description: 'Larik baris; tiap baris larik sel. Mis. [["Item","Qty"],["Apel",10],["Total","=SUM(B2:B2)"]].',
          items: { type: 'array', items: {} },
        },
      },
      required: ['start', 'rows'],
    },
  },
  {
    name: 'sheet_format',
    description: 'Memformat rentang sel: tebal, warna latar, warna huruf, format angka, rata teks. Hanya sebutkan yang ingin diubah.',
    input_schema: {
      type: 'object',
      properties: {
        sheet: sheetProp,
        range: { type: 'string', description: 'Mis. "A1:D1".' },
        bold: { type: 'boolean' },
        background: { type: 'string', description: 'Warna latar #RRGGBB, mis. "#DDE7FF".' },
        color: { type: 'string', description: 'Warna huruf #RRGGBB.' },
        number_format: { type: 'string', description: 'Mis. "#,##0", "#,##0.00", "0%", "0.00%", "Rp #,##0", "dd/mm/yyyy".' },
        align: { type: 'string', enum: ['left', 'center', 'right'] },
      },
      required: ['range'],
    },
  },
  {
    name: 'sheet_width',
    description: 'Mengatur lebar kolom (dalam jumlah karakter, 4-80).',
    input_schema: {
      type: 'object',
      properties: { sheet: sheetProp, column: { type: 'string', description: 'Huruf kolom, mis. "A".' }, width: { type: 'number' } },
      required: ['column', 'width'],
    },
  },
  {
    name: 'sheet_clear',
    description: 'Menghapus isi dan format pada suatu rentang.',
    input_schema: { type: 'object', properties: { sheet: sheetProp, range: { type: 'string' } }, required: ['range'] },
  },
  {
    name: 'sheet_add',
    description: `Menambah sheet baru (maks. ${LIMITS.MAX_SHEETS} sheet; nama 1-31 karakter).`,
    input_schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
  },
];

export const SHEET_TOOL_NAMES = new Set(sheetToolDefinitions.map((t) => t.name));
