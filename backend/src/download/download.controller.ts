import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { Controller, Get, Header, NotFoundException, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';

interface Installer {
  file: string;
  name: string;
  version: string;
  size: number;
  mtimeMs: number;
}

/** Folder berisi installer hasil build (desktop/release). Di server, arahkan lewat MIB_RELEASE_DIR. */
const releaseDir = () => path.resolve(process.env.MIB_RELEASE_DIR ?? path.join(process.cwd(), '..', 'desktop', 'release'));

const cmpVersion = (a: string, b: string) => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  return 0;
};

function latestInstaller(): Installer | null {
  const dir = releaseDir();
  if (!existsSync(dir)) return null;
  let best: Installer | null = null;
  for (const name of readdirSync(dir)) {
    const m = /^MiB Setup (\d+\.\d+\.\d+)\.exe$/.exec(name);
    if (!m) continue;
    const file = path.join(dir, name);
    const st = statSync(file);
    if (!st.isFile()) continue;
    if (!best || cmpVersion(m[1], best.version) > 0) best = { file, name, version: m[1], size: st.size, mtimeMs: st.mtimeMs };
  }
  return best;
}

const hashCache = new Map<string, string>();
function sha256(i: Installer): Promise<string> {
  const key = `${i.file}:${i.size}:${i.mtimeMs}`;
  const hit = hashCache.get(key);
  if (hit) return Promise.resolve(hit);
  return new Promise((resolve, reject) => {
    const h = createHash('sha256');
    createReadStream(i.file)
      .on('data', (c) => h.update(c))
      .on('error', reject)
      .on('end', () => {
        const hex = h.digest('hex');
        hashCache.clear();
        hashCache.set(key, hex);
        resolve(hex);
      });
  });
}

/** Alamat publik untuk skrip pemasang. Header Host divalidasi ketat agar tidak bisa menyisipkan perintah ke skrip. */
function publicOrigin(req: Request): string {
  const fixed = process.env.PUBLIC_URL;
  if (fixed && /^https?:\/\/[A-Za-z0-9.-]+(:\d{1,5})?$/.test(fixed)) return fixed;
  const host = req.get('host') ?? '';
  if (!/^[A-Za-z0-9.-]+(:\d{1,5})?$/.test(host)) throw new NotFoundException();
  const proto = req.protocol === 'https' ? 'https' : 'http';
  return `${proto}://${host}`;
}

@Controller('download')
export class DownloadController {
  @Get('info')
  async info() {
    const i = latestInstaller();
    if (!i) return { available: false };
    return { available: true, version: i.version, size: i.size, sha256: await sha256(i), file: 'MiB-Setup.exe' };
  }

  @Get('windows')
  windows(@Res() res: Response) {
    const i = latestInstaller();
    if (!i) throw new NotFoundException('Installer belum tersedia');
    res.setHeader('Content-Type', 'application/vnd.microsoft.portable-executable');
    res.setHeader('Content-Length', String(i.size));
    res.setHeader('Content-Disposition', `attachment; filename="MiB-Setup-${i.version}.exe"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    createReadStream(i.file).pipe(res);
  }

  /** Pemasang satu baris: `irm <alamat>/download/install.ps1 | iex` — mengunduh, memeriksa SHA-256, lalu menjalankan installer. */
  @Get('install.ps1')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  async script(@Req() req: Request) {
    const i = latestInstaller();
    if (!i) throw new NotFoundException('Installer belum tersedia');
    const origin = publicOrigin(req);
    const hash = await sha256(i);
    return [
      `# Pemasang MiB ${i.version}`,
      `$ErrorActionPreference = 'Stop'`,
      `$url = '${origin}/download/windows'`,
      `$sha = '${hash}'`,
      `$out = Join-Path $env:TEMP 'MiB-Setup.exe'`,
      `Write-Host 'Mengunduh MiB ${i.version}...'`,
      `Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing`,
      `if ((Get-FileHash $out -Algorithm SHA256).Hash.ToLower() -ne $sha) { Remove-Item $out -Force; throw 'Berkas rusak: SHA-256 tidak cocok. Pemasangan dibatalkan.' }`,
      `Write-Host 'Menjalankan pemasang...'`,
      `Start-Process -FilePath $out`,
      ``,
    ].join('\r\n');
  }
}
