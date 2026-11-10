import { spawn } from 'node:child_process';

export const SHELL_DEFAULT_TIMEOUT_MS = 60_000;
export const SHELL_MAX_TIMEOUT_MS = 300_000;
export const SHELL_MAX_OUTPUT = 20_000;

export interface ShellResult {
  output: string;
  exitCode: number | null;
  timedOut: boolean;
  truncated: boolean;
}

/**
 * Variabel lingkungan yang diteruskan ke perintah. Sisanya (kunci API, JWT_SECRET, DATABASE_URL, dsb.) sengaja
 * tidak ikut, supaya perintah yang dijalankan agen tidak bisa membaca rahasia MiB lewat `env`.
 */
const ENV_ALLOW = [
  'PATH', 'PATHEXT', 'SystemRoot', 'SYSTEMROOT', 'ComSpec', 'windir', 'TEMP', 'TMP', 'TMPDIR',
  'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'ProgramFiles', 'ProgramFiles(x86)', 'ProgramData',
  'USERNAME', 'USER', 'LANG', 'LC_ALL', 'TERM', 'OS', 'PROCESSOR_ARCHITECTURE', 'NUMBER_OF_PROCESSORS',
];

export function cleanEnv(src: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {};
  for (const k of Object.keys(src)) {
    if (ENV_ALLOW.some((a) => a.toLowerCase() === k.toLowerCase())) out[k] = src[k];
  }
  return out;
}

/** Menjalankan perintah di cwd dengan batas waktu dan batas keluaran; seluruh pohon proses dimatikan saat habis waktu/dibatalkan. */
export function runShell(command: string, cwd: string, timeoutMs: number, signal: AbortSignal): Promise<ShellResult> {
  return new Promise((resolve) => {
    const win = process.platform === 'win32';
    const child = win
      ? spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command], {
          cwd,
          env: cleanEnv(),
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        })
      : spawn('/bin/sh', ['-c', command], { cwd, env: cleanEnv(), stdio: ['ignore', 'pipe', 'pipe'], detached: true });

    let output = '';
    let truncated = false;
    let timedOut = false;
    let settled = false;
    const take = (b: Buffer) => {
      if (output.length >= SHELL_MAX_OUTPUT) {
        truncated = true;
        return;
      }
      output += b.toString('utf8');
      if (output.length > SHELL_MAX_OUTPUT) {
        output = output.slice(0, SHELL_MAX_OUTPUT);
        truncated = true;
      }
    };
    child.stdout.on('data', take);
    child.stderr.on('data', take);

    const kill = () => {
      if (child.pid === undefined) return;
      try {
        if (win) spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
        else process.kill(-child.pid, 'SIGKILL');
      } catch {
        /* proses sudah selesai */
      }
    };
    const timer = setTimeout(() => {
      timedOut = true;
      kill();
    }, timeoutMs);
    const onAbort = () => kill();
    signal.addEventListener('abort', onAbort, { once: true });

    const finish = (exitCode: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      resolve({ output, exitCode, timedOut, truncated });
    };
    child.on('error', (e) => {
      output += `\n[gagal menjalankan: ${e.message}]`;
      finish(null);
    });
    child.on('close', (code) => finish(code));
  });
}
