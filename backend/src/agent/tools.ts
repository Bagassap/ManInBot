import type Anthropic from '@anthropic-ai/sdk';
import { localToolsFor } from '../local/local-tools.js';
import { sheetToolDefinitions } from '../workbooks/sheet-tools.js';

export const toolDefinitions: Anthropic.Tool[] = [
  {
    name: 'get_current_time',
    description: 'Mengambil tanggal dan jam saat ini pada zona waktu tertentu.',
    input_schema: {
      type: 'object',
      properties: {
        timezone: {
          type: 'string',
          description: 'Nama zona waktu IANA, mis. "Asia/Jakarta". Default: Asia/Jakarta.',
        },
      },
    },
  },
  {
    name: 'calculate',
    description:
      'Menghitung ekspresi matematika (+ - * / % ^ dan tanda kurung). Gunakan ini untuk setiap perhitungan agar akurat.',
    input_schema: {
      type: 'object',
      properties: { expression: { type: 'string', description: 'Mis. "(12500 * 3) + 4000 / 8"' } },
      required: ['expression'],
    },
  },
];

/** Daftar alat yang ditawarkan ke model. */
export const toolsFor = (): Anthropic.Tool[] => [...toolDefinitions, ...sheetToolDefinitions, ...localToolsFor()];

export interface ToolOutput {
  content: string;
  isError?: boolean;
}

/** Penghitung aman: parser rekursif, tanpa eval/Function. */
export function calculate(expression: string): number {
  const src = expression.replace(/\s+/g, '');
  if (!src || src.length > 200) throw new Error('Ekspresi kosong atau terlalu panjang');
  let i = 0;

  const peek = () => src[i];
  const number = (): number => {
    const m = /^\d+(\.\d+)?/.exec(src.slice(i));
    if (!m) throw new Error(`Karakter tidak valid pada posisi ${i + 1}`);
    i += m[0].length;
    return parseFloat(m[0]);
  };
  const primary = (): number => {
    if (peek() === '(') {
      i++;
      const v = expr();
      if (peek() !== ')') throw new Error('Tanda kurung tidak seimbang');
      i++;
      return v;
    }
    if (peek() === '-') {
      i++;
      return -primary();
    }
    if (peek() === '+') {
      i++;
      return primary();
    }
    return number();
  };
  const power = (): number => {
    const base = primary();
    if (peek() === '^') {
      i++;
      return Math.pow(base, power());
    }
    return base;
  };
  const term = (): number => {
    let v = power();
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = src[i++];
      const r = power();
      if (op === '*') v *= r;
      else if (r === 0) throw new Error('Pembagian dengan nol');
      else v = op === '/' ? v / r : v % r;
    }
    return v;
  };
  const expr = (): number => {
    let v = term();
    while (peek() === '+' || peek() === '-') {
      const op = src[i++];
      const r = term();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  };

  const result = expr();
  if (i < src.length) throw new Error(`Karakter tidak valid pada posisi ${i + 1}`);
  if (!Number.isFinite(result)) throw new Error('Hasil tidak terdefinisi');
  // Buang artefak pecahan biner (mis. 0.1+0.2 = 0.30000000000000004) agar hasilnya wajar dibaca/diucapkan.
  return Number(result.toPrecision(12));
}

export function runTool(name: string, input: unknown): ToolOutput {
  const args = (input ?? {}) as Record<string, unknown>;
  try {
    switch (name) {
      case 'get_current_time': {
        const timeZone = typeof args.timezone === 'string' && args.timezone ? args.timezone : 'Asia/Jakarta';
        const text = new Intl.DateTimeFormat('id-ID', {
          dateStyle: 'full',
          timeStyle: 'long',
          timeZone,
        }).format(new Date());
        return { content: `${text} (${timeZone})` };
      }
      case 'calculate': {
        if (typeof args.expression !== 'string') throw new Error('expression harus berupa teks');
        return { content: String(calculate(args.expression)) };
      }
      default:
        return { content: `Alat tidak dikenal: ${name}`, isError: true };
    }
  } catch (err) {
    return { content: err instanceof Error ? err.message : 'Gagal menjalankan alat', isError: true };
  }
}
