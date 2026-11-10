import { realpath } from 'node:fs/promises';
import path from 'node:path';

export interface FolderRule {
  path: string;
  mode: 'READ' | 'READWRITE';
}

/** Galat yang pesannya aman ditampilkan ke pengguna dan dikembalikan ke model sebagai hasil alat. */
export class LocalToolError extends Error {}

const isWin = process.platform === 'win32';

/** target berada di dalam (atau sama dengan) root. Windows tidak membedakan huruf besar/kecil. */
export function isInside(root: string, target: string): boolean {
  const a = isWin ? root.toLowerCase() : root;
  const b = isWin ? target.toLowerCase() : target;
  const rel = path.relative(a, b);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * realpath untuk jalur yang mungkin belum ada (mis. berkas baru): realpath leluhur terdalam yang ada, lalu sisa
 * segmennya ditempel kembali. Dengan begini symlink/junction di leluhur tidak bisa dipakai keluar dari folder izin.
 */
export async function realpathLoose(abs: string): Promise<string> {
  const rest: string[] = [];
  let cur = abs;
  for (;;) {
    try {
      const real = await realpath(cur);
      return rest.length ? path.join(real, ...rest.reverse()) : real;
    } catch (e) {
      const parent = path.dirname(cur);
      if (parent === cur || (e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
      rest.push(path.basename(cur));
      cur = parent;
    }
  }
}

export interface Resolved {
  abs: string;
  rule: FolderRule;
}

/**
 * Mengubah jalur dari agen menjadi jalur absolut yang sudah dipastikan berada di dalam salah satu folder izin.
 * Jalur relatif dihitung dari folder izin pertama. Tulis butuh folder bermode READWRITE.
 */
export async function resolveInside(rules: FolderRule[], raw: unknown, needWrite: boolean): Promise<Resolved> {
  if (rules.length === 0) {
    throw new LocalToolError('Belum ada folder yang diizinkan. Minta pengguna menambahkannya di Pengaturan → Folder lokal.');
  }
  if (typeof raw !== 'string' || !raw.trim()) throw new LocalToolError('Jalur kosong');
  if (raw.includes('\0')) throw new LocalToolError('Jalur tidak valid');
  // Windows: aliran data alternatif ("berkas.txt:rahasia") dan jalur perangkat tidak diizinkan
  if (isWin && (/^\\\\[?.]\\/.test(raw) || raw.slice(2).includes(':'))) throw new LocalToolError('Jalur tidak valid');

  const abs = path.resolve(path.isAbsolute(raw) ? raw : path.join(rules[0].path, raw));
  let real: string;
  try {
    real = await realpathLoose(abs);
  } catch {
    throw new LocalToolError('Jalur tidak dapat dibaca');
  }

  let readable: FolderRule | null = null;
  for (const rule of rules) {
    let root: string;
    try {
      root = await realpath(rule.path);
    } catch {
      continue; // folder izin sudah tidak ada
    }
    if (!isInside(root, real)) continue;
    if (!needWrite || rule.mode === 'READWRITE') return { abs: real, rule };
    readable = rule;
  }
  if (readable) throw new LocalToolError(`Folder ${readable.path} hanya boleh dibaca, tidak boleh diubah.`);
  throw new LocalToolError(
    `Jalur di luar folder yang diizinkan. Folder yang diizinkan: ${rules.map((r) => r.path).join(', ')}`,
  );
}
