import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../workspaces/audit.service.js';
import { ApprovalsService } from './approvals.service.js';
import { DRIVER_SCRIPT } from './computer-driver.js';
import { LocalToolError } from './paths.js';
import { cleanEnv } from './shell.js';
import type { LocalCtx } from './types.js';

/** Kendali komputer hanya untuk aplikasi yang berjalan di komputer pengguna sendiri (Windows), bukan server bersama. */
export const computerEnabled = () => process.platform === 'win32' && process.env.MIB_LOCAL === '1';

export interface ComputerOutput {
  content: string;
  isError?: boolean;
  image?: { mediaType: 'image/jpeg'; data: string };
}

interface DriverReply {
  ok: boolean;
  ready?: boolean;
  stop?: 'esc' | 'mouse';
  blocked?: boolean;
  error?: string;
  w?: number;
  h?: number;
  img?: string;
}

const MAX_ACTIONS = 300;
const TYPE_MAX = 4000;
const START_TIMEOUT_MS = 30_000;

/** Aplikasi yang boleh diluncurkan agen: nama tetap -> perintah tetap (tidak pernah dari teks bebas). */
const APPS: Record<string, string> = {
  word: 'winword',
  excel: 'excel',
  powerpoint: 'powerpnt',
  outlook: 'outlook',
};

/**
 * Penjaga "khusus kantor" yang ditegakkan di pengendali: masukan mouse/papan ketik hanya dikirim bila jendela sasarannya
 * milik salah satu proses ini. Jendela lain (peramban, terminal, Pengaturan, bilah tugas, dialog Jalankan) ditolak.
 * `t` = pola judul jendela .
 */
export const OFFICE_WINDOWS: { p: string; t?: string }[] = [
  { p: 'WINWORD' },
  { p: 'EXCEL' },
  { p: 'POWERPNT' },
  { p: 'OUTLOOK' },
  { p: 'olk' },
  { p: 'ONENOTE' },
  { p: 'MSPUB' },
];

class Driver {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private waiter: ((r: DriverReply) => void) | null = null;
  private ready: Promise<void> | null = null;

  private start(): Promise<void> {
    const encoded = Buffer.from(DRIVER_SCRIPT, 'utf16le').toString('base64');
    const proc = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], {
      env: cleanEnv(),
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.proc = proc;
    proc.stderr.resume();
    createInterface({ input: proc.stdout }).on('line', (line) => {
      let r: DriverReply;
      try {
        r = JSON.parse(line) as DriverReply;
      } catch {
        return;
      }
      const w = this.waiter;
      this.waiter = null;
      w?.(r);
    });
    proc.once('exit', () => {
      if (this.proc === proc) this.proc = null;
      this.ready = null;
      const w = this.waiter;
      this.waiter = null;
      w?.({ ok: false, error: 'Pengendali layar berhenti' });
    });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.stop();
        reject(new LocalToolError('Pengendali layar tidak siap (PowerShell terlalu lama merespons)'));
      }, START_TIMEOUT_MS);
      this.waiter = (r) => {
        clearTimeout(timer);
        r.ready ? resolve() : reject(new LocalToolError(r.error ?? 'Pengendali layar gagal dimulai'));
      };
    });
  }

  async send(cmd: Record<string, unknown>, timeoutMs: number, signal: AbortSignal): Promise<DriverReply> {
    if (signal.aborted) throw new LocalToolError('Dibatalkan');
    this.ready ??= this.start();
    await this.ready;
    const proc = this.proc;
    if (!proc) throw new LocalToolError('Pengendali layar tidak berjalan');
    return new Promise<DriverReply>((resolve, reject) => {
      const done = () => {
        clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
      };
      const onAbort = () => {
        done();
        this.stop(); // mematikan driver juga menghentikan ketikan yang sedang berjalan
        reject(new LocalToolError('Dibatalkan'));
      };
      const timer = setTimeout(() => {
        done();
        this.stop();
        reject(new LocalToolError('Aksi melebihi batas waktu'));
      }, timeoutMs);
      signal.addEventListener('abort', onAbort, { once: true });
      this.waiter = (r) => {
        done();
        resolve(r);
      };
      proc.stdin.write(`${JSON.stringify(cmd)}\n`);
    });
  }

  stop() {
    const p = this.proc;
    this.proc = null;
    this.ready = null;
    this.waiter = null;
    if (p && p.exitCode === null) spawn('taskkill', ['/pid', String(p.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  }
}

interface Session {
  task: string;
  actions: number;
}

const int = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : undefined);
const needXY = (i: Record<string, unknown>) => {
  const x = int(i.x);
  const y = int(i.y);
  if (x === undefined || y === undefined) throw new LocalToolError('Aksi ini membutuhkan koordinat x dan y (dalam piksel tangkapan layar)');
  return { x, y };
};

@Injectable()
export class ComputerService {
  private readonly driver = new Driver();
  private readonly sessions = new Map<string, Session>();

  constructor(
    private readonly approvals: ApprovalsService,
    private readonly audit: AuditService,
  ) {}

  /** Dipanggil saat satu putaran agen selesai (sukses, gagal, atau dibatalkan). */
  endRun(conversationId: string) {
    if (this.sessions.delete(conversationId) && this.sessions.size === 0) this.driver.stop();
  }

  async start(i: Record<string, unknown>, ctx: LocalCtx): Promise<ComputerOutput> {
    if (!computerEnabled()) throw new LocalToolError('Kendali komputer hanya tersedia di aplikasi MiB yang berjalan di komputer Windows pengguna');
    const task = typeof i.task === 'string' ? i.task.trim().slice(0, 500) : '';
    if (!task) throw new LocalToolError('Parameter task wajib: jelaskan apa yang akan kamu kerjakan di layar');
    if (this.sessions.has(ctx.conversationId)) throw new LocalToolError('Sesi kendali sudah aktif; langsung pakai alat computer');

    const ok = await this.approvals.request(ctx, {
      tool: 'computer_start',
      summary: 'MiB ingin mengendalikan mouse dan keyboard komputer Anda',
      detail: `Tugas: ${task}\n\nMiB akan melihat layar, menggerakkan mouse, dan mengetik sendiri. Untuk menghentikan kapan saja: tekan Esc, gerakkan mouse sendiri, atau tekan tombol ■ di kolom chat MiB. Jangan biarkan layar menampilkan data rahasia yang tidak terkait.`,
    });
    if (!ok) return { content: 'Pengguna menolak memberi kendali komputer. Jangan meminta lagi tanpa bertanya; tawarkan membuat berkas dengan doc_create.', isError: true };

    this.sessions.set(ctx.conversationId, { task, actions: 0 });
    await this.audit.log({ workspaceId: ctx.workspaceId, actorId: ctx.userId, actorEmail: ctx.userEmail, action: 'computer.start', detail: task });
    const out = await this.act({ action: 'screenshot' }, ctx, false);
    return { ...out, content: `Sesi kendali dimulai. ${out.content}` };
  }

  async stopSession(ctx: LocalCtx): Promise<ComputerOutput> {
    const had = this.sessions.has(ctx.conversationId);
    this.endRun(ctx.conversationId);
    if (had) await this.audit.log({ workspaceId: ctx.workspaceId, actorId: ctx.userId, actorEmail: ctx.userEmail, action: 'computer.stop' });
    return { content: had ? 'Sesi kendali komputer diakhiri.' : 'Tidak ada sesi kendali yang aktif.' };
  }

  async run(i: Record<string, unknown>, ctx: LocalCtx): Promise<ComputerOutput> {
    return this.act(i, ctx, true);
  }

  private async act(i: Record<string, unknown>, ctx: LocalCtx, count: boolean): Promise<ComputerOutput> {
    if (!computerEnabled()) throw new LocalToolError('Kendali komputer tidak tersedia di sini');
    const session = this.sessions.get(ctx.conversationId);
    if (!session) throw new LocalToolError('Belum ada sesi kendali. Panggil computer_start dulu (pengguna akan diminta izin).');
    if (count && ++session.actions > MAX_ACTIONS) {
      this.endRun(ctx.conversationId);
      throw new LocalToolError(`Batas ${MAX_ACTIONS} aksi per sesi tercapai; sesi diakhiri. Minta pengguna melanjutkan bila perlu.`);
    }

    const action = typeof i.action === 'string' ? i.action : '';
    let cmd: Record<string, unknown>;
    let label = action;
    let timeout = 20_000;

    switch (action) {
      case 'screenshot':
        cmd = { action };
        break;
      case 'launch': {
        const name = typeof i.app === 'string' ? i.app.toLowerCase() : '';
        const exe = APPS[name];
        if (!exe) throw new LocalToolError(`Aplikasi tidak dikenal. Pilihan: ${Object.keys(APPS).join(', ')}. Aplikasi di luar daftar ini tidak boleh dioperasikan.`);
        await this.launch(exe);
        label = `launch ${name}`;
        await new Promise((r) => setTimeout(r, 2500)); // beri waktu aplikasi muncul
        cmd = { action: 'wait', seconds: 1, rebase: true }; // Windows bisa menggeser kursor saat jendela baru muncul
        break;
      }
      case 'move':
        cmd = { action, ...needXY(i) };
        label = `move ${i.x},${i.y}`;
        break;
      case 'click':
      case 'double_click':
      case 'triple_click':
      case 'right_click':
      case 'middle_click': {
        const hasXY = i.x !== undefined || i.y !== undefined;
        cmd = { action, ...(hasXY ? needXY(i) : {}) };
        label = `${action}${hasXY ? ` ${i.x},${i.y}` : ''}`;
        break;
      }
      case 'drag': {
        const to_x = int(i.to_x);
        const to_y = int(i.to_y);
        if (to_x === undefined || to_y === undefined) throw new LocalToolError('drag membutuhkan x, y, to_x, to_y');
        cmd = { action, ...needXY(i), to_x, to_y };
        label = `drag ${i.x},${i.y} → ${to_x},${to_y}`;
        break;
      }
      case 'scroll': {
        const amount = int(i.amount);
        if (amount === undefined || amount === 0 || Math.abs(amount) > 50) throw new LocalToolError('scroll membutuhkan amount bukan nol (maks. 50; positif = ke bawah)');
        cmd = { action, amount, ...(i.x !== undefined ? needXY(i) : {}) };
        label = `scroll ${amount}`;
        break;
      }
      case 'type': {
        const text = typeof i.text === 'string' ? i.text : '';
        if (!text) throw new LocalToolError('type membutuhkan text');
        if (text.length > TYPE_MAX) throw new LocalToolError(`Teks terlalu panjang (maks. ${TYPE_MAX} karakter per panggilan); bagi menjadi beberapa panggilan`);
        const delay = Math.min(Math.max(int(i.delay_ms) ?? 15, 0), 100);
        cmd = { action, text_b64: Buffer.from(text, 'utf8').toString('base64'), delay_ms: delay };
        label = `type "${text.slice(0, 60)}${text.length > 60 ? '…' : ''}" (${text.length} karakter)`;
        timeout = 20_000 + text.length * (delay + 25);
        break;
      }
      case 'key': {
        const keys = typeof i.keys === 'string' ? i.keys.trim() : '';
        if (!keys || keys.length > 60) throw new LocalToolError('key membutuhkan keys, mis. "ctrl+s", "enter", "alt+f4"');
        if (/(^|\+)\s*(win|meta)\s*(\+|$)/i.test(keys)) throw new LocalToolError('Tombol Windows tidak diizinkan (membuka menu Start/jendela di luar aplikasi kantor)');
        cmd = { action, keys };
        label = `key ${keys}`;
        break;
      }
      case 'wait': {
        const seconds = Math.min(Math.max(int(i.seconds) ?? 1, 0), 10);
        cmd = { action, seconds };
        label = `wait ${seconds}s`;
        timeout = 20_000 + seconds * 1000;
        break;
      }
      default:
        throw new LocalToolError(`Aksi tidak dikenal: ${action}. Pilihan: screenshot, launch, move, click, double_click, triple_click, right_click, middle_click, drag, scroll, type, key, wait`);
    }

    const r = await this.driver.send({ ...cmd, allow: OFFICE_WINDOWS }, timeout, ctx.signal);
    if (r.blocked) {
      await this.audit.log({ workspaceId: ctx.workspaceId, actorId: ctx.userId, actorEmail: ctx.userEmail, action: 'computer.blocked', detail: `${label} -> ${r.error ?? ''}`.slice(0, 200) });
      return {
        content: `DIBLOKIR: aksi "${label}" tidak dikirim karena jendela sasarannya (${r.error}) bukan aplikasi kantor. MiB hanya boleh mengoperasikan Microsoft Office (Word, Excel, PowerPoint, Outlook, OneNote, Publisher). Jangan mencoba mengakalinya; beri tahu pengguna.`,
        isError: true,
      };
    }
    await this.audit.log({ workspaceId: ctx.workspaceId, actorId: ctx.userId, actorEmail: ctx.userEmail, action: 'computer.action', detail: label.slice(0, 200) });

    if (r.stop) {
      this.endRun(ctx.conversationId);
      await this.audit.log({ workspaceId: ctx.workspaceId, actorId: ctx.userId, actorEmail: ctx.userEmail, action: 'computer.interrupted', detail: `${r.stop} ${r.error ?? ''}`.trim() });
      return {
        content: `Pengguna menghentikan kendali (${r.stop === 'esc' ? 'menekan Esc' : 'menggerakkan mouse sendiri'}). Sesi diakhiri. Jangan melanjutkan mengendalikan komputer; tanyakan pengguna apa yang ingin dilakukan.`,
        isError: true,
      };
    }
    if (!r.ok || !r.img) throw new LocalToolError(r.error ?? 'Aksi gagal');
    return {
      content: `Selesai: ${label}. Layar sekarang ${r.w}×${r.h} piksel (koordinat dalam ukuran gambar ini; lingkaran merah = posisi kursor).`,
      image: { mediaType: 'image/jpeg', data: r.img },
    };
  }

  private launch(exe: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Nama berasal dari daftar tetap di atas, bukan dari masukan model.
      const c = spawn('cmd.exe', ['/c', 'start', '', exe], { windowsHide: true, detached: true, stdio: 'ignore' });
      c.once('error', () => reject(new LocalToolError('Tidak bisa meluncurkan aplikasi')));
      c.once('spawn', () => {
        c.unref();
        resolve();
      });
    });
  }
}
