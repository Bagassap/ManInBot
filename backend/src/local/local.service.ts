import { mkdir, open, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../workspaces/audit.service.js';
import { WorkbooksService } from '../workbooks/workbooks.service.js';
import { MAX_UPLOAD_BYTES } from '../workbooks/xlsx-io.js';
import { ComputerService } from './computer.js';
import { buildDocx, buildPptx, DOC_MAX_INPUT, DOC_TEXT_MAX, editOoxml, parseBlocks, parseReplacements, parseSlides, readDocumentText, readPdfText } from './documents.js';
import { isOpenable, openWithDefaultApp } from './open-app.js';
import { ApprovalsService } from './approvals.service.js';
import { LOCAL_TOOL_NAMES } from './local-tools.js';
import { LocalToolError, resolveInside, type FolderRule } from './paths.js';
import { runShell, SHELL_DEFAULT_TIMEOUT_MS, SHELL_MAX_TIMEOUT_MS } from './shell.js';
import type { LocalCtx } from './types.js';

export interface LocalOutput {
  content: string;
  isError?: boolean;
  /** Tangkapan layar yang dikirim ke model (tidak disimpan ke riwayat). */
  image?: { mediaType: 'image/jpeg'; data: string };
}

const READ_MAX = 200_000;
const WRITE_MAX = 1_000_000;
const LIST_MAX = 300;

const str = (v: unknown, name: string): string => {
  if (typeof v !== 'string') throw new LocalToolError(`Parameter ${name} wajib berupa teks`);
  return v;
};
const int = (v: unknown, def: number, min: number, max: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(Math.max(Math.trunc(v), min), max) : def;

@Injectable()
export class LocalToolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly approvals: ApprovalsService,
    private readonly audit: AuditService,
    private readonly workbooks: WorkbooksService,
    private readonly computer: ComputerService,
  ) {}

  /** Mengakhiri sesi kendali komputer milik percakapan ini (dipanggil saat putaran agen selesai). */
  endRun(conversationId: string) {
    this.computer.endRun(conversationId);
  }

  isLocalTool(name: string) {
    return LOCAL_TOOL_NAMES.has(name);
  }

  folders(workspaceId: string): Promise<FolderRule[]> {
    return this.prisma.allowedFolder.findMany({ where: { workspaceId }, select: { path: true, mode: true }, orderBy: { createdAt: 'asc' } });
  }

  async run(name: string, input: unknown, ctx: LocalCtx): Promise<LocalOutput> {
    const i = (input ?? {}) as Record<string, unknown>;
    try {
      const rules = await this.folders(ctx.workspaceId);
      switch (name) {
        case 'list_allowed_folders':
          return {
            content: rules.length
              ? rules.map((r) => `${r.path}  [${r.mode}]`).join('\n')
              : 'Belum ada folder yang diizinkan. Minta pengguna menambahkannya di Pengaturan → Folder lokal.',
          };
        case 'fs_list':
          return await this.list(rules, i);
        case 'fs_read':
          return await this.read(rules, i);
        case 'fs_write':
          return await this.write(rules, i, ctx);
        case 'shell_run':
          return await this.shell(rules, i, ctx);
        case 'computer_start':
          return await this.computer.start(i, ctx);
        case 'computer':
          return await this.computer.run(i, ctx);
        case 'computer_stop':
          return await this.computer.stopSession(ctx);
        case 'doc_read':
          return await this.docRead(rules, i);
        case 'doc_create':
          return await this.docCreate(rules, i, ctx);
        case 'doc_edit':
          return await this.docEdit(rules, i, ctx);
        case 'app_open':
          return await this.appOpen(rules, i, ctx);
        case 'excel_open_local':
          return await this.excelOpen(rules, i, ctx);
        case 'excel_save_local':
          return await this.excelSave(rules, i, ctx);
        default:
          return { content: `Alat tidak dikenal: ${name}`, isError: true };
      }
    } catch (e) {
      if (e instanceof LocalToolError) return { content: e.message, isError: true };
      const code = (e as NodeJS.ErrnoException).code;
      const msg =
        code === 'ENOENT' ? 'Berkas atau folder tidak ditemukan'
        : code === 'EACCES' || code === 'EPERM' ? 'Tidak punya izin sistem untuk mengakses jalur ini'
        : code === 'EISDIR' ? 'Jalur ini adalah folder, bukan berkas'
        : code === 'ENOTDIR' ? 'Bagian jalur ini bukan folder'
        : e instanceof Error ? e.message : 'Galat tidak dikenal';
      return { content: msg, isError: true };
    }
  }

  private async list(rules: FolderRule[], i: Record<string, unknown>): Promise<LocalOutput> {
    const { abs } = await resolveInside(rules, i.path, false);
    const entries = await readdir(abs, { withFileTypes: true });
    const rows = await Promise.all(
      entries.slice(0, LIST_MAX).map(async (d) => {
        try {
          const s = await stat(path.join(abs, d.name));
          return `${d.isDirectory() ? '[folder]' : '[berkas]'} ${d.name}${d.isDirectory() ? '' : `  ${s.size} byte`}  ${s.mtime.toISOString().slice(0, 16).replace('T', ' ')}`;
        } catch {
          return `[?] ${d.name}`;
        }
      }),
    );
    return { content: `${abs}\n${rows.join('\n') || '(kosong)'}${entries.length > LIST_MAX ? `\n… ${entries.length - LIST_MAX} entri lain tidak ditampilkan` : ''}` };
  }

  private async read(rules: FolderRule[], i: Record<string, unknown>): Promise<LocalOutput> {
    const { abs } = await resolveInside(rules, i.path, false);
    const s = await stat(abs);
    if (!s.isFile()) throw new LocalToolError('Ini bukan berkas');
    const offset = int(i.offset, 0, 0, Number.MAX_SAFE_INTEGER);
    const max = int(i.max_bytes, READ_MAX, 1, READ_MAX);
    const fh = await open(abs, 'r');
    try {
      const buf = Buffer.alloc(Math.min(max, Math.max(0, s.size - offset)));
      const { bytesRead } = await fh.read(buf, 0, buf.length, offset);
      const chunk = buf.subarray(0, bytesRead);
      if (chunk.subarray(0, 8192).includes(0)) throw new LocalToolError('Berkas biner tidak bisa dibaca sebagai teks');
      const more = offset + bytesRead < s.size;
      return { content: `${chunk.toString('utf8')}${more ? `\n\n[… berkas masih berlanjut; ${s.size - offset - bytesRead} byte tersisa, lanjutkan dengan offset=${offset + bytesRead}]` : ''}` };
    } finally {
      await fh.close();
    }
  }

  private async write(rules: FolderRule[], i: Record<string, unknown>, ctx: LocalCtx): Promise<LocalOutput> {
    const content = str(i.content, 'content');
    if (Buffer.byteLength(content) > WRITE_MAX) throw new LocalToolError('Isi terlalu besar (maksimal 1 MB)');
    const { abs } = await resolveInside(rules, i.path, true);
    const existing = await stat(abs).catch(() => null);
    const exists = existing !== null;
    if (existing?.isDirectory()) throw new LocalToolError('Jalur ini adalah folder');
    if (exists && i.overwrite !== true) throw new LocalToolError('Berkas sudah ada. Setel overwrite=true bila memang boleh ditimpa (baca isinya dulu).');

    const ok = await this.approvals.request(ctx, {
      tool: 'fs_write',
      summary: `${exists ? 'Menimpa' : 'Membuat'} berkas ${abs} (${Buffer.byteLength(content)} byte)`,
      detail: content.length > 1500 ? `${content.slice(0, 1500)}\n… (dipotong)` : content,
    });
    if (!ok) return { content: 'Pengguna menolak menulis berkas ini. Jangan coba lagi tanpa bertanya; tawarkan alternatif.', isError: true };

    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, content, 'utf8');
    await this.audit.log({ workspaceId: ctx.workspaceId, actorId: ctx.userId, actorEmail: ctx.userEmail, action: 'local.fs_write', target: abs, detail: `${Buffer.byteLength(content)} byte` });
    return { content: `Tersimpan: ${abs} (${Buffer.byteLength(content)} byte)` };
  }

  private async shell(rules: FolderRule[], i: Record<string, unknown>, ctx: LocalCtx): Promise<LocalOutput> {
    const command = str(i.command, 'command').trim();
    if (!command) throw new LocalToolError('Perintah kosong');
    if (command.length > 4000) throw new LocalToolError('Perintah terlalu panjang');
    // Perintah boleh mengubah isi folder, jadi cwd harus di folder yang boleh ditulis.
    const { abs: cwd } = await resolveInside(rules, i.cwd ?? rules[0]?.path, true);
    if (!(await stat(cwd)).isDirectory()) throw new LocalToolError('cwd bukan folder');
    const timeout = int(i.timeout_seconds, SHELL_DEFAULT_TIMEOUT_MS / 1000, 1, SHELL_MAX_TIMEOUT_MS / 1000) * 1000;

    const ok = await this.approvals.request(ctx, {
      tool: 'shell_run',
      summary: `Menjalankan perintah di ${cwd}`,
      detail: command,
    });
    if (!ok) return { content: 'Pengguna menolak menjalankan perintah ini. Jangan coba lagi tanpa bertanya; tawarkan alternatif.', isError: true };

    const r = await runShell(command, cwd, timeout, ctx.signal);
    await this.audit.log({
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      actorEmail: ctx.userEmail,
      action: 'local.shell_run',
      target: cwd,
      detail: `${command.slice(0, 300)} → kode ${r.exitCode}${r.timedOut ? ' (habis waktu)' : ''}`,
    });
    const head = r.timedOut ? `Dihentikan: melebihi ${timeout / 1000} detik.` : `Kode keluar: ${r.exitCode}`;
    return { content: `${head}\n${r.output || '(tanpa keluaran)'}${r.truncated ? '\n[keluaran dipotong]' : ''}`, isError: r.timedOut || r.exitCode !== 0 };
  }

  private async docRead(rules: FolderRule[], i: Record<string, unknown>): Promise<LocalOutput> {
    const { abs } = await resolveInside(rules, i.path, false);
    const ext = path.extname(abs).toLowerCase();
    if (ext !== '.docx' && ext !== '.pptx' && ext !== '.pdf') throw new LocalToolError('doc_read hanya untuk .docx, .pptx, dan .pdf (teks biasa: fs_read; .xlsx: excel_open_local)');
    const s = await stat(abs);
    if (!s.isFile()) throw new LocalToolError('Ini bukan berkas');
    if (s.size > DOC_MAX_INPUT) throw new LocalToolError('Berkas terlalu besar (maksimal 20 MB)');
    const data = await readFile(abs);
    const text = ext === '.pdf' ? await readPdfText(data) : await readDocumentText(data, ext);
    if (!text) return { content: '(dokumen tidak berisi teks)' };
    return { content: text.length > DOC_TEXT_MAX ? `${text.slice(0, DOC_TEXT_MAX)}\n\n[… dipotong; teks total ${text.length} karakter]` : text };
  }

  private async docEdit(rules: FolderRule[], i: Record<string, unknown>, ctx: LocalCtx): Promise<LocalOutput> {
    const { abs: src } = await resolveInside(rules, i.path, false);
    const ext = path.extname(src).toLowerCase();
    if (ext !== '.docx' && ext !== '.pptx') throw new LocalToolError('doc_edit hanya untuk .docx dan .pptx');
    const s = await stat(src);
    if (!s.isFile()) throw new LocalToolError('Ini bukan berkas');
    if (s.size > DOC_MAX_INPUT) throw new LocalToolError('Berkas terlalu besar (maksimal 20 MB)');
    const pairs = parseReplacements(i.replacements);

    // Tujuan: berkas lain (save_as) atau menimpa aslinya; keduanya butuh izin tulis.
    const target = typeof i.save_as === 'string' && i.save_as.trim() ? i.save_as : src;
    const { abs: dest } = await resolveInside(rules, target, true);
    if (path.extname(dest).toLowerCase() !== ext) throw new LocalToolError(`save_as harus berekstensi ${ext}`);
    const destExists = dest === src ? true : await stat(dest).then(() => true, () => false);
    if (destExists && i.overwrite !== true) throw new LocalToolError(dest === src ? 'Mengubah berkas asli butuh overwrite=true, atau isi save_as untuk menyimpan ke berkas baru.' : 'save_as sudah ada. Setel overwrite=true bila boleh ditimpa.');

    const { buffer, counts } = await editOoxml(await readFile(src), ext, pairs);
    const total = counts.reduce((a, b) => a + b, 0);
    const missing = pairs.filter((_, n) => counts[n] === 0).map((p) => `"${p.find.slice(0, 60)}"`);
    if (total === 0) throw new LocalToolError('Teks yang dicari tidak ditemukan di dokumen (pencocokan persis, peka huruf besar-kecil, dan harus dalam satu paragraf). Baca dokumen dengan doc_read lalu salin teksnya persis.');

    const detail = pairs.map((p, n) => `${counts[n]}× "${p.find.slice(0, 80)}" → "${p.replace.slice(0, 80)}"`).join('\n');
    const ok = await this.approvals.request(ctx, {
      tool: 'doc_edit',
      summary: `${dest === src ? 'Mengubah dokumen asli' : `Menyimpan salinan yang diedit ke ${dest} dari`} ${src} (${total} penggantian)`,
      detail: detail.length > 1500 ? `${detail.slice(0, 1500)}\n… (dipotong)` : detail,
    });
    if (!ok) return { content: 'Pengguna menolak mengubah dokumen ini. Jangan coba lagi tanpa bertanya; tawarkan alternatif.', isError: true };

    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, buffer);
    await this.audit.log({ workspaceId: ctx.workspaceId, actorId: ctx.userId, actorEmail: ctx.userEmail, action: 'local.doc_edit', target: dest, detail: `${total} penggantian` });
    return { content: `Tersimpan: ${dest} (${total} penggantian).${missing.length ? ` Tidak ditemukan: ${missing.join(', ')}.` : ''}` };
  }

  private async docCreate(rules: FolderRule[], i: Record<string, unknown>, ctx: LocalCtx): Promise<LocalOutput> {
    const { abs } = await resolveInside(rules, i.path, true);
    const ext = path.extname(abs).toLowerCase();
    if (ext !== '.docx' && ext !== '.pptx') throw new LocalToolError('Nama berkas harus berakhiran .docx atau .pptx');
    const existing = await stat(abs).catch(() => null);
    if (existing?.isDirectory()) throw new LocalToolError('Jalur ini adalah folder');
    if (existing && i.overwrite !== true) throw new LocalToolError('Berkas sudah ada. Setel overwrite=true bila memang boleh ditimpa.');

    let buffer: Buffer;
    let outline: string;
    if (ext === '.docx') {
      const blocks = parseBlocks(i.blocks);
      buffer = await buildDocx(blocks);
      outline = blocks
        .map((b) => (b.type === 'heading' ? `# ${b.text}` : b.type === 'paragraph' ? b.text.slice(0, 120) : b.type === 'bullets' ? `• ${b.items.length} butir` : `[tabel ${b.rows.length} baris]`))
        .join('\n');
    } else {
      const slides = parseSlides(i.slides);
      buffer = await buildPptx(slides);
      outline = slides.map((sl, n) => `${n + 1}. ${sl.title}${sl.bullets?.length ? ` (${sl.bullets.length} butir)` : ''}`).join('\n');
    }

    const ok = await this.approvals.request(ctx, {
      tool: 'doc_create',
      summary: `${existing ? 'Menimpa' : 'Membuat'} dokumen ${abs} (${buffer.length} byte)`,
      detail: outline.length > 1500 ? `${outline.slice(0, 1500)}\n… (dipotong)` : outline,
    });
    if (!ok) return { content: 'Pengguna menolak membuat dokumen ini. Jangan coba lagi tanpa bertanya; tawarkan alternatif.', isError: true };

    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, buffer);
    await this.audit.log({ workspaceId: ctx.workspaceId, actorId: ctx.userId, actorEmail: ctx.userEmail, action: 'local.doc_create', target: abs, detail: `${buffer.length} byte` });
    return { content: `Tersimpan: ${abs} (${buffer.length} byte)` };
  }

  private async appOpen(rules: FolderRule[], i: Record<string, unknown>, ctx: LocalCtx): Promise<LocalOutput> {
    const { abs } = await resolveInside(rules, i.path, false);
    if (!isOpenable(abs)) throw new LocalToolError('Jenis berkas ini tidak boleh dibuka lewat alat ini (hanya dokumen, bukan program)');
    const s = await stat(abs);
    if (!s.isFile()) throw new LocalToolError('Ini bukan berkas');
    const ok = await this.approvals.request(ctx, { tool: 'app_open', summary: `Membuka ${abs} di aplikasi bawaan Anda`, detail: undefined });
    if (!ok) return { content: 'Pengguna menolak membuka berkas ini. Jangan coba lagi tanpa bertanya.', isError: true };
    await openWithDefaultApp(abs);
    await this.audit.log({ workspaceId: ctx.workspaceId, actorId: ctx.userId, actorEmail: ctx.userEmail, action: 'local.app_open', target: abs });
    return { content: `Dibuka di aplikasi bawaan: ${abs}` };
  }

  private async excelOpen(rules: FolderRule[], i: Record<string, unknown>, ctx: LocalCtx): Promise<LocalOutput> {
    const { abs } = await resolveInside(rules, i.path, false);
    if (!/\.xlsx$/i.test(abs)) throw new LocalToolError('Hanya berkas .xlsx yang bisa dibuka');
    const s = await stat(abs);
    if (!s.isFile()) throw new LocalToolError('Ini bukan berkas');
    if (s.size > MAX_UPLOAD_BYTES) throw new LocalToolError('Berkas terlalu besar (maksimal 5 MB)');
    const snapshot = await this.workbooks.importFile(ctx.workspaceId, ctx.userId, ctx.conversationId, await readFile(abs), path.basename(abs));
    ctx.emit({ type: 'sheet_reset', snapshot });
    await this.audit.log({ workspaceId: ctx.workspaceId, actorId: ctx.userId, actorEmail: ctx.userEmail, action: 'local.excel_open', target: abs });
    return { content: `Dibuka di layar bersama: ${abs}. Sheet: ${snapshot.sheets.map((x) => `${x.name} (${x.rows}×${x.cols})`).join(', ')}. Gunakan sheet_info/sheet_read untuk membaca isinya.${snapshot.warnings?.length ? ` Catatan: ${snapshot.warnings.join('; ')}` : ''}` };
  }

  private async excelSave(rules: FolderRule[], i: Record<string, unknown>, ctx: LocalCtx): Promise<LocalOutput> {
    const { abs } = await resolveInside(rules, i.path, true);
    if (!/\.xlsx$/i.test(abs)) throw new LocalToolError('Nama berkas harus berakhiran .xlsx');
    const exists = await stat(abs).then(() => true, () => false);
    if (exists && i.overwrite !== true) throw new LocalToolError('Berkas sudah ada. Setel overwrite=true bila boleh ditimpa.');
    const { buffer } = await this.workbooks.exportFile(ctx.workspaceId, ctx.userId, ctx.conversationId).catch(() => {
      throw new LocalToolError('Belum ada lembar kerja untuk disimpan');
    });

    const ok = await this.approvals.request(ctx, {
      tool: 'excel_save_local',
      summary: `${exists ? 'Menimpa' : 'Menyimpan'} berkas Excel ${abs} (${buffer.length} byte)`,
    });
    if (!ok) return { content: 'Pengguna menolak menyimpan berkas ini. Tawarkan alternatif, mis. tombol Unduh .xlsx.', isError: true };

    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, buffer);
    await this.audit.log({ workspaceId: ctx.workspaceId, actorId: ctx.userId, actorEmail: ctx.userEmail, action: 'local.excel_save', target: abs, detail: `${buffer.length} byte` });
    return { content: `Tersimpan: ${abs} (${buffer.length} byte)` };
  }
}
