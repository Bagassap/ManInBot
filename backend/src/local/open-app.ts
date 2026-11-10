import { spawn } from 'node:child_process';
import path from 'node:path';
import { LocalToolError } from './paths.js';

/** Hanya berkas dokumen/data. Program (.exe, .bat, .ps1, .lnk, .js, dst.) tidak pernah dibuka lewat alat ini. */
const OPENABLE = new Set(['.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt', '.pdf', '.txt', '.csv', '.md', '.rtf', '.odt', '.ods', '.odp', '.png', '.jpg', '.jpeg']);

export const isOpenable = (file: string) => OPENABLE.has(path.extname(file).toLowerCase());

/** Membuka berkas dengan aplikasi bawaan OS. Tanpa shell: jalur diteruskan sebagai satu argumen. */
export function openWithDefaultApp(file: string): Promise<void> {
  if (!isOpenable(file)) throw new LocalToolError('Jenis berkas ini tidak boleh dibuka lewat alat ini (hanya dokumen, bukan program)');
  const [cmd, args] =
    process.platform === 'win32' ? ['explorer.exe', [file]] : process.platform === 'darwin' ? ['open', [file]] : ['xdg-open', [file]];
  return new Promise((resolve, reject) => {
    const c = spawn(cmd, args, { detached: true, stdio: 'ignore' });
    c.once('error', () => reject(new LocalToolError('Tidak bisa membuka aplikasi di komputer ini')));
    c.once('spawn', () => {
      c.unref();
      resolve();
    });
  });
}
