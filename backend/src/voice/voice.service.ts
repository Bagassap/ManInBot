import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { cpus, homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { BadRequestException, ConflictException, Injectable, type OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { BrainService } from '../brain/brain.service.js';

/** Kosakata kantor agar nama aplikasi tidak salah dengar. */
const STT_PROMPT = 'Perintah kerja kantor: buka Word, Excel, PowerPoint, Outlook, simpan dokumen, buat tabel, laporan, surat, notulen.';

/** Membaca suara Windows (WinRT) ke WAV di stdout. Teks lewat variabel lingkungan base64 agar aman dari injeksi. */
export const TTS_SCRIPT = `
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null=[Windows.Media.SpeechSynthesis.SpeechSynthesizer,Windows.Media.SpeechSynthesis,ContentType=WindowsRuntime]
$lang=$env:MIB_TTS_LANG
$v=[Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | Where-Object { $_.Language -like "$lang*" } | Select-Object -First 1
if($env:MIB_TTS_CHECK -eq '1'){ if($v){[Console]::Out.Write($v.DisplayName)}; exit 0 }
if(-not $v){ exit 3 }
$t=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:MIB_TTS_TEXT))
$s=New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
$s.Voice=$v
$m=[System.WindowsRuntimeSystemExtensions].GetMethods()|Where-Object{$_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1'}|Select-Object -First 1
$task=$m.MakeGenericMethod([Windows.Media.SpeechSynthesis.SpeechSynthesisStream]).Invoke($null,@($s.SynthesizeTextToStreamAsync($t)))
$task.Wait()
$in=[System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($task.Result)
$out=[Console]::OpenStandardOutput()
$in.CopyTo($out)
$out.Flush()
`;

/** Membuang penanda non-ucapan dari keluaran Whisper. */
export function cleanTranscript(raw: string) {
  return raw
    .replace(/\[[^\]]*\]|\([^)]*\)|\*[^*]*\*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Teks jawaban yang enak didengar: tanpa simbol markdown, blok kode, atau alamat panjang. */
export function speakable(raw: string, max = 900) {
  const t = raw
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[*_#>|~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return end > 80 ? cut.slice(0, end + 1) : cut;
}

/** WAV PCM 16 kHz mono 16-bit, format yang dikirim antarmuka MiB. */
export function isValidWav(b: Buffer) {
  return (
    b.length > 44 &&
    b.toString('latin1', 0, 4) === 'RIFF' &&
    b.toString('latin1', 8, 12) === 'WAVE' &&
    b.readUInt16LE(20) === 1 &&
    b.readUInt16LE(22) === 1 &&
    b.readUInt32LE(24) === 16000 &&
    b.readUInt16LE(34) === 16
  );
}

interface VoiceJob {
  running: boolean;
  pct: number | null;
  message: string;
  error: string | null;
}

/** Suara lokal: mendengar lewat Whisper, berbicara lewat suara Indonesia milik Windows. Tidak ada audio yang keluar dari komputer. */
@Injectable()
export class VoiceService implements OnModuleDestroy {
  private readonly root = path.join(process.env.LOCALAPPDATA || homedir(), 'MiB', 'voice');
  private proc: ChildProcess | null = null;
  private job: VoiceJob = { running: false, pct: null, message: '', error: null };
  private voiceName: string | null | undefined;
  private busy = false;

  constructor(private readonly brain: BrainService) {}

  private get exe() {
    return path.join(this.root, 'whisper', 'whisper-cli.exe');
  }

  private modelFile() {
    try {
      const c = JSON.parse(readFileSync(path.join(this.root, 'voice.json'), 'utf8').replace(/^﻿/, '')) as { model?: string };
      if (c.model !== 'ggml-base-q5_1.bin' && c.model !== 'ggml-small-q5_1.bin') return null;
      const f = path.join(this.root, c.model);
      return existsSync(f) ? f : null;
    } catch {
      return null;
    }
  }

  private get sttReady() {
    return existsSync(this.exe) && this.modelFile() !== null;
  }

  private tts(env: Record<string, string>) {
    const encoded = Buffer.from(TTS_SCRIPT, 'utf16le').toString('base64');
    return spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
      env: { SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP, PATH: process.env.PATH, USERPROFILE: process.env.USERPROFILE, MIB_TTS_LANG: process.env.MIB_TTS_LANG || 'id', ...env },
    });
  }

  private findVoice(): Promise<string | null> {
    return new Promise((resolve) => {
      let out = '';
      const p = this.tts({ MIB_TTS_CHECK: '1' });
      p.stdout?.on('data', (d: Buffer) => (out += d.toString()));
      p.once('error', () => resolve(null));
      p.once('exit', () => resolve(out.trim() || null));
    });
  }

  async status() {
    // Dicek ulang selama belum ada: pengguna bisa menambah suara di Pengaturan Windows tanpa menutup MiB.
    if (!this.voiceName) this.voiceName = await this.findVoice();
    return { sttReady: this.sttReady, ttsReady: !!this.voiceName, voice: this.voiceName ?? null, job: this.job };
  }

  setup() {
    if (this.job.running) throw new ConflictException('Pemasangan suara sedang berjalan.');
    const file = process.env.MIB_VOICE_SCRIPT;
    if (!file || !existsSync(file)) throw new BadRequestException('Pemasang suara tidak ditemukan. Pasang ulang MiB.');
    const model = this.brain.numCtx <= 8192 ? 'base' : 'small';
    const p = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', file, '-Model', model, '-Json'], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    this.proc = p;
    this.job = { running: true, pct: null, message: 'Memulai...', error: null };
    createInterface({ input: p.stdout! }).on('line', (line) => {
      try {
        const e = JSON.parse(line) as { phase: string; pct: number | null; msg: string };
        this.job = { ...this.job, pct: e.pct, message: e.msg, error: e.phase === 'error' ? e.msg : this.job.error };
      } catch {
        /* baris bukan JSON */
      }
    });
    const finish = (code: number | null) => {
      this.proc = null;
      this.job = { ...this.job, running: false, error: code === 0 ? null : (this.job.error ?? 'Pemasangan suara berhenti. Coba lagi.') };
    };
    p.once('error', () => finish(1));
    p.once('exit', finish);
    return { ok: true };
  }

  /** Membuka halaman Ucapan di Pengaturan Windows untuk menambah suara Indonesia. */
  openVoiceSettings() {
    spawn('explorer.exe', ['ms-settings:speech'], { windowsHide: true, stdio: 'ignore', detached: true }).unref();
    this.voiceName = undefined;
    return { ok: true };
  }

  async transcribe(wav: Buffer) {
    if (!isValidWav(wav)) throw new BadRequestException('Format audio tidak dikenali.');
    const model = this.modelFile();
    if (!model || !existsSync(this.exe)) throw new ServiceUnavailableException('Suara MiB belum dipasang.');
    if (this.busy) throw new ConflictException('Masih memproses suara sebelumnya.');
    this.busy = true;
    const dir = await mkdtemp(path.join(tmpdir(), 'mib-voice-'));
    try {
      const file = path.join(dir, 'in.wav');
      await writeFile(file, wav);
      const threads = String(Math.max(2, Math.min(8, Math.floor(cpus().length / 2))));
      const text = await new Promise<string>((resolve, reject) => {
        let out = '';
        const p = spawn(this.exe, ['-m', model, '-f', file, '-l', 'id', '-t', threads, '-nt', '-np', '--prompt', STT_PROMPT], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
        const timer = setTimeout(() => p.kill(), 120_000);
        p.stdout.on('data', (d: Buffer) => (out += d.toString('utf8')));
        p.once('error', (e) => (clearTimeout(timer), reject(e)));
        p.once('exit', (code) => {
          clearTimeout(timer);
          if (code === 0) resolve(out);
          else reject(new Error(`whisper berhenti (${code})`));
        });
      });
      return { text: cleanTranscript(text) };
    } finally {
      this.busy = false;
      await rm(dir, { recursive: true, force: true }).catch(() => undefined); // rekaman tidak disimpan
    }
  }

  speak(text: string): Promise<Buffer> {
    const clean = speakable(text);
    if (!clean) throw new BadRequestException('Tidak ada teks untuk dibacakan.');
    return new Promise((resolve, reject) => {
      const parts: Buffer[] = [];
      const p = this.tts({ MIB_TTS_TEXT: Buffer.from(clean, 'utf8').toString('base64') });
      const timer = setTimeout(() => p.kill(), 30_000);
      p.stdout?.on('data', (d: Buffer) => parts.push(d));
      p.once('error', (e) => (clearTimeout(timer), reject(e)));
      p.once('exit', (code) => {
        clearTimeout(timer);
        if (code === 0 && parts.length) resolve(Buffer.concat(parts));
        else if (code === 3) reject(new ServiceUnavailableException('Suara bahasa Indonesia belum ada di Windows.'));
        else reject(new ServiceUnavailableException('Gagal membacakan jawaban.'));
      });
    });
  }

  onModuleDestroy() {
    if (this.proc?.pid) spawn('taskkill', ['/pid', String(this.proc.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  }
}
