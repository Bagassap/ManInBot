import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { BadRequestException, ConflictException, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';

export type BrainTier = 'ringan' | 'sedang' | 'kuat';

export const TIERS: Record<BrainTier, { model: string; label: string; forCpu: string; downloadGb: number; numCtx: number }> = {
  ringan: { model: 'qwen3:1.7b', label: 'Ringan', forCpu: 'Core i3 / Ryzen 3', downloadGb: 3, numCtx: 8192 },
  sedang: { model: 'qwen3:4b', label: 'Sedang', forCpu: 'Core i5 / Ryzen 5', downloadGb: 4, numCtx: 12288 },
  kuat: { model: 'qwen3:8b', label: 'Kuat', forCpu: 'Core i7 / Ryzen 7', downloadGb: 7, numCtx: 16384 },
};

export interface OllamaToolCall {
  function: { name: string; arguments: Record<string, unknown> | string };
}
export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: OllamaToolCall[];
  tool_name?: string;
}
export interface OllamaChunk {
  message?: { content?: string; tool_calls?: OllamaToolCall[] };
  done?: boolean;
  error?: string;
  prompt_eval_count?: number;
  eval_count?: number;
}
export interface OllamaTool {
  type: 'function';
  function: { name: string; description: string; parameters: unknown };
}

interface SetupJob {
  running: boolean;
  phase: string;
  pct: number | null;
  message: string;
  error: string | null;
}

/** Otak lokal: mengelola Ollama milik MiB (port sendiri, folder sendiri) dan pemasangannya. */
@Injectable()
export class BrainService implements OnModuleDestroy {
  private readonly logger = new Logger(BrainService.name);
  private readonly root = path.join(process.env.LOCALAPPDATA || homedir(), 'MiB');
  private readonly url = process.env.MIB_OLLAMA_URL || 'http://127.0.0.1:11435';
  private server: ChildProcess | null = null;
  private starting: Promise<void> | null = null;
  private setupProc: ChildProcess | null = null;
  private job: SetupJob = { running: false, phase: '', pct: null, message: '', error: null };
  private detected: { tier: BrainTier; pc: string } | null = null;
  private readonly installedListeners: (() => void)[] = [];

  private get exe() {
    return path.join(this.root, 'ollama', 'ollama.exe');
  }

  private config(): { tier: BrainTier; model: string } | null {
    if (process.env.MIB_OLLAMA_MODEL) return { tier: 'sedang', model: process.env.MIB_OLLAMA_MODEL };
    try {
      const c = JSON.parse(readFileSync(path.join(this.root, 'brain.json'), 'utf8').replace(/^﻿/, '')) as { tier?: string; model?: string };
      return c.tier && c.tier in TIERS && c.model === TIERS[c.tier as BrainTier].model ? { tier: c.tier as BrainTier, model: c.model } : null;
    } catch {
      return null;
    }
  }

  get ready() {
    return this.config() !== null && (!!process.env.MIB_OLLAMA_URL || existsSync(this.exe));
  }

  /** Model yang benar-benar terpasang; null bila belum ada. */
  get installed() {
    return this.ready ? this.config() : null;
  }

  /** Dipanggil setiap kali pemasangan model selesai dengan sukses. */
  onInstalled(fn: () => void) {
    this.installedListeners.push(fn);
  }

  get modelName() {
    return this.config()?.model ?? 'belum dipasang';
  }

  get numCtx() {
    return TIERS[this.config()?.tier ?? 'sedang'].numCtx;
  }

  private async alive() {
    try {
      return (await fetch(`${this.url}/api/version`, { signal: AbortSignal.timeout(1500) })).ok;
    } catch {
      return false;
    }
  }

  /** Menyalakan Ollama milik MiB bila belum berjalan. */
  private async ensureServer() {
    if (await this.alive()) return;
    if (process.env.MIB_OLLAMA_URL) throw new Error('Mesin AI tidak bisa dihubungi.');
    this.starting ??= this.boot().finally(() => (this.starting = null));
    await this.starting;
  }

  private async boot() {
    if (!existsSync(this.exe)) throw new Error('Mesin AI belum terpasang.');
    const p = spawn(this.exe, ['serve'], {
      windowsHide: true,
      stdio: 'ignore',
      env: {
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
        TEMP: process.env.TEMP,
        TMP: process.env.TMP,
        USERPROFILE: process.env.USERPROFILE,
        LOCALAPPDATA: process.env.LOCALAPPDATA,
        OLLAMA_HOST: '127.0.0.1:11435',
        OLLAMA_MODELS: path.join(this.root, 'models'),
      },
    });
    this.server = p;
    p.once('exit', () => {
      if (this.server === p) this.server = null;
    });
    for (let i = 0; i < 80; i++) {
      if (await this.alive()) return;
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error('Mesin AI tidak mau menyala.');
  }

  /** Satu giliran percakapan; potongan jawaban dialirkan apa adanya dari Ollama. */
  async *chat(body: { messages: OllamaMessage[]; tools: OllamaTool[] }, signal: AbortSignal): AsyncGenerator<OllamaChunk> {
    const cfg = this.config();
    if (!cfg) throw new Error('Otak MiB belum dipasang.');
    await this.ensureServer();
    const r = await fetch(`${this.url}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal,
      body: JSON.stringify({
        model: cfg.model,
        messages: body.messages,
        tools: body.tools,
        stream: true,
        think: false,
        keep_alive: '30m',
        options: { num_ctx: this.numCtx, temperature: 0.2, num_predict: 2048 },
      }),
    });
    if (!r.ok || !r.body) throw new Error(`Mesin AI menolak permintaan (${r.status}): ${(await r.text().catch(() => '')).slice(0, 200)}`);
    const decoder = new TextDecoder();
    let tail = '';
    for await (const chunk of r.body as unknown as AsyncIterable<Uint8Array>) {
      tail += decoder.decode(chunk, { stream: true });
      let i: number;
      while ((i = tail.indexOf('\n')) >= 0) {
        const line = tail.slice(0, i).trim();
        tail = tail.slice(i + 1);
        if (line) yield JSON.parse(line) as OllamaChunk;
      }
    }
    if (tail.trim()) yield JSON.parse(tail) as OllamaChunk;
  }

  private script(args: string[]) {
    const file = process.env.MIB_BRAIN_SCRIPT;
    if (!file || !existsSync(file)) throw new BadRequestException('Pemasang otak tidak ditemukan. Pasang ulang MiB.');
    return spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', file, ...args], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  }

  private detect(): Promise<{ tier: BrainTier; pc: string } | null> {
    if (this.detected) return Promise.resolve(this.detected);
    return new Promise((resolve) => {
      let out = '';
      let p: ChildProcess;
      try {
        p = this.script(['-Detect']);
      } catch {
        return resolve(null);
      }
      p.stdout?.on('data', (d: Buffer) => (out += d.toString()));
      p.once('error', () => resolve(null));
      p.once('exit', () => {
        const at = out.indexOf('|');
        const tier = out.slice(0, at);
        if (at > 0 && tier in TIERS) {
          this.detected = { tier: tier as BrainTier, pc: out.slice(at + 1).trim() };
          resolve(this.detected);
        } else resolve(null);
      });
    });
  }

  async status() {
    const cfg = this.config();
    return {
      ready: this.ready,
      tier: cfg?.tier ?? null,
      model: cfg?.model ?? null,
      detected: await this.detect(),
      tiers: TIERS,
      job: this.job,
    };
  }

  /** Memasang atau mengganti model; berjalan di latar belakang, kemajuannya dibaca lewat status(). */
  setup(tier: BrainTier) {
    if (this.job.running) throw new ConflictException('Pemasangan sedang berjalan.');
    const p = this.script(['-Tier', tier, '-Json']);
    this.setupProc = p;
    this.job = { running: true, phase: 'start', pct: null, message: 'Memulai...', error: null };
    createInterface({ input: p.stdout! }).on('line', (line) => {
      try {
        const e = JSON.parse(line) as { phase: string; pct: number | null; msg: string };
        this.job = { ...this.job, phase: e.phase, pct: e.pct, message: e.msg, error: e.phase === 'error' ? e.msg : this.job.error };
      } catch {
        /* baris bukan JSON */
      }
    });
    p.stderr?.resume();
    const finish = (code: number | null) => {
      this.setupProc = null;
      this.job = { ...this.job, running: false, error: code === 0 ? null : (this.job.error ?? 'Pemasangan berhenti. Coba lagi.') };
      if (code === 0) this.installedListeners.forEach((fn) => fn());
    };
    p.once('error', () => finish(1));
    p.once('exit', finish);
    return { ok: true };
  }

  cancelSetup() {
    const p = this.setupProc;
    if (p?.pid) spawn('taskkill', ['/pid', String(p.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    return { ok: true };
  }

  onModuleDestroy() {
    this.cancelSetup();
    if (this.server?.pid) {
      this.logger.log('menghentikan mesin AI');
      spawn('taskkill', ['/pid', String(this.server.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    }
  }
}
