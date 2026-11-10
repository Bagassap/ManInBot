import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isInside, LocalToolError, resolveInside, type FolderRule } from './paths.js';

let base: string;
let allowed: string;
let outside: string;
let rw: FolderRule[];
let ro: FolderRule[];

beforeAll(() => {
  base = mkdtempSync(path.join(tmpdir(), 'mib-paths-'));
  allowed = path.join(base, 'kantor');
  outside = path.join(base, 'rahasia');
  mkdirSync(path.join(allowed, 'sub'), { recursive: true });
  mkdirSync(outside);
  writeFileSync(path.join(outside, 'gaji.txt'), 'rahasia');
  writeFileSync(path.join(allowed, 'a.txt'), 'a');
  rw = [{ path: allowed, mode: 'READWRITE' }];
  ro = [{ path: allowed, mode: 'READ' }];
});
afterAll(() => rmSync(base, { recursive: true, force: true }));

describe('isInside', () => {
  it('menerima folder itu sendiri dan isinya, menolak tetangga berawalan sama', () => {
    expect(isInside('/a/b', '/a/b')).toBe(true);
    expect(isInside('/a/b', '/a/b/c/d')).toBe(true);
    expect(isInside('/a/b', '/a/bc')).toBe(false);
    expect(isInside('/a/b', '/a')).toBe(false);
  });
});

describe('resolveInside', () => {
  it('jalur relatif dihitung dari folder izin pertama', async () => {
    const r = await resolveInside(rw, 'a.txt', false);
    expect(path.basename(r.abs)).toBe('a.txt');
  });
  it('berkas baru (belum ada) di dalam folder izin diterima', async () => {
    const r = await resolveInside(rw, path.join(allowed, 'sub', 'baru', 'x.txt'), true);
    expect(r.abs.endsWith(path.join('sub', 'baru', 'x.txt'))).toBe(true);
  });
  it('menolak ../ yang keluar folder', async () => {
    await expect(resolveInside(rw, '../rahasia/gaji.txt', false)).rejects.toBeInstanceOf(LocalToolError);
    await expect(resolveInside(rw, path.join(allowed, '..', 'rahasia', 'gaji.txt'), false)).rejects.toBeInstanceOf(LocalToolError);
  });
  it('menolak jalur absolut di luar folder', async () => {
    await expect(resolveInside(rw, path.join(outside, 'gaji.txt'), false)).rejects.toThrow(/luar folder/);
  });
  it('folder READ tidak boleh ditulis, tapi boleh dibaca', async () => {
    await expect(resolveInside(ro, 'a.txt', true)).rejects.toThrow(/hanya boleh dibaca/);
    await expect(resolveInside(ro, 'a.txt', false)).resolves.toBeTruthy();
  });
  it('tanpa folder izin semua ditolak dengan petunjuk', async () => {
    await expect(resolveInside([], 'a.txt', false)).rejects.toThrow(/Belum ada folder/);
  });
  it('menolak jalur kosong, bertipe salah, dan berisi NUL', async () => {
    await expect(resolveInside(rw, '', false)).rejects.toThrow();
    await expect(resolveInside(rw, 42, false)).rejects.toThrow();
    await expect(resolveInside(rw, 'a\0.txt', false)).rejects.toThrow();
  });
  it('symlink di dalam folder izin yang menunjuk ke luar tidak bisa dipakai keluar', async () => {
    const link = path.join(allowed, 'pintas');
    try {
      symlinkSync(outside, link, 'junction');
    } catch {
      return; // lingkungan tanpa izin membuat symlink: lewati
    }
    await expect(resolveInside(rw, path.join('pintas', 'gaji.txt'), false)).rejects.toThrow(/luar folder/);
    await expect(resolveInside(rw, path.join('pintas', 'baru.txt'), true)).rejects.toThrow(/luar folder/);
  });
  it.runIf(process.platform === 'win32')('Windows: menolak aliran data alternatif dan jalur perangkat', async () => {
    await expect(resolveInside(rw, `${path.join(allowed, 'a.txt')}:rahasia`, false)).rejects.toThrow(/tidak valid/);
    await expect(resolveInside(rw, '\\\\?\\C:\\Windows\\win.ini', false)).rejects.toThrow(/tidak valid/);
  });
});
