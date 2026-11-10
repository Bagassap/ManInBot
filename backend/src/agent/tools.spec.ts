import { describe, expect, it } from 'vitest';
import { calculate, runTool } from './tools.js';

describe('calculate', () => {
  it.each([
    ['2+2', 4],
    ['(12500 * 3) + 4000 / 8', 38000],
    ['2^3^2', 512],
    ['-(3+4)*2', -14],
    ['10 % 4', 2],
    ['0.1 + 0.2', 0.3],
    ['(12500000 * 1.11)', 13875000],
  ])('%s = %s', (expr, expected) => {
    expect(calculate(expr)).toBe(expected);
  });

  it.each(['', '1/0', '2+', '(1+2', 'alert(1)', '1; process.exit()', '__proto__'])('menolak %j', (expr) => {
    expect(() => calculate(expr)).toThrow();
  });
});

describe('runTool', () => {
  it('mengembalikan error untuk alat tidak dikenal', () => {
    expect(runTool('nope', {}).isError).toBe(true);
  });

  it('mengembalikan error (bukan melempar) untuk zona waktu tidak valid', () => {
    expect(runTool('get_current_time', { timezone: 'Bukan/Zona' }).isError).toBe(true);
  });

  it('get_current_time memakai Asia/Jakarta secara default', () => {
    expect(runTool('get_current_time', {}).content).toContain('Asia/Jakarta');
  });
});

describe('daftar alat (Excel dan dokumen)', () => {
  const names = async () => (await import('./tools.js')).toolsFor().map((t) => t.name);
  it('chat utama punya alat Excel dan dokumen', async () => {
    const n = await names();
    for (const t of ['sheet_info', 'sheet_read', 'sheet_write', 'excel_open_local', 'excel_save_local', 'doc_read', 'doc_create', 'fs_read']) expect(n).toContain(t);
  });
  it('tidak ada nama alat ganda', async () => {
    {
      const n = await names();
      expect(new Set(n).size).toBe(n.length);
    }
  });
});
