// Menyusun paket situs publik dari hasil ekspor statis frontend + installer.
// Pemakaian: node deploy/build-site.cjs <origin, mis. https://mib.example.com atau http://1.2.3.4>
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'frontend', 'out');
const relDir = path.join(root, 'desktop', 'release');
const dist = path.join(__dirname, 'dist');
const origin = (process.argv[2] || '').replace(/\/+$/, '');
if (!/^https?:\/\/[A-Za-z0-9.-]+(:\d{1,5})?$/.test(origin)) throw new Error('Argumen origin tidak valid, mis. https://mib.example.com');

// Halaman yang hanya berguna di aplikasi desktop (butuh layanan lokal) tidak dipublikasikan di situs promosi.
const DESKTOP_ONLY = ['app', 'admin', 'masuk', 'daftar'];

fs.rmSync(dist, { recursive: true, force: true });
const site = path.join(dist, 'site');
fs.cpSync(outDir, site, { recursive: true });

for (const name of fs.readdirSync(site)) {
  const base = name.replace(/^__next\./, '').replace(/\.(html|txt)$/, '');
  if (DESKTOP_ONLY.includes(base)) fs.rmSync(path.join(site, name), { recursive: true, force: true });
}

// Prefetch segmen Next meminta "__next.a.b.__PAGE__.txt", padahal di disk berkasnya "__next.a/b/__PAGE__.txt".
// Nginx statis tidak bisa memetakan itu, jadi buat salinan dengan nama datar.
let flattened = 0;
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (!e.isDirectory()) continue;
    if (e.name.startsWith('__next.')) {
      (function inner(d, rel) {
        for (const f of fs.readdirSync(d, { withFileTypes: true })) {
          const fp = path.join(d, f.name);
          if (f.isDirectory()) inner(fp, [...rel, f.name]);
          else if (f.name.endsWith('.txt')) {
            const stem = f.name.replace(/\.txt$/, '');
            const flat = `${e.name}.${[...rel, stem].join('.')}.txt`;
            fs.copyFileSync(fp, path.join(dir, flat));
            flattened++;
          }
        }
      })(p, []);
    } else walk(p);
  }
})(site);

// Installer terbaru
const installers = fs
  .readdirSync(relDir)
  .map((n) => ({ n, m: /^MiB Setup (\d+\.\d+\.\d+)\.exe$/.exec(n) }))
  .filter((x) => x.m)
  .sort((a, b) => a.m[1].localeCompare(b.m[1], undefined, { numeric: true }));
if (!installers.length) throw new Error('Installer belum ada di desktop/release');
const inst = installers[installers.length - 1];
const file = path.join(relDir, inst.n);
const version = inst.m[1];
const size = fs.statSync(file).size;
const sha = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

const dl = path.join(dist, 'downloads');
fs.mkdirSync(dl, { recursive: true });
fs.copyFileSync(file, path.join(dl, 'MiB-Setup.exe'));
fs.writeFileSync(path.join(dl, 'info.json'), JSON.stringify({ available: true, version, size, sha256: sha, file: 'MiB-Setup.exe' }));
fs.writeFileSync(
  path.join(dl, 'install.ps1'),
  [
    `# Pemasang MiB ${version}`,
    `$ErrorActionPreference = 'Stop'`,
    `$url = '${origin}/download/windows'`,
    `$sha = '${sha}'`,
    `$out = Join-Path $env:TEMP 'MiB-Setup.exe'`,
    `Write-Host 'Mengunduh MiB ${version}...'`,
    `Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing`,
    `if ((Get-FileHash $out -Algorithm SHA256).Hash.ToLower() -ne $sha) { Remove-Item $out -Force; throw 'Berkas rusak: SHA-256 tidak cocok. Pemasangan dibatalkan.' }`,
    `Write-Host 'Menjalankan pemasang...'`,
    `Start-Process -FilePath $out`,
    ``,
  ].join('\r\n'),
);
fs.writeFileSync(path.join(dist, 'meta.json'), JSON.stringify({ version, file, installerName: `MiB-Setup-${version}.exe`, sha256: sha, size }));
console.log(`[site] ${version}  ${(size / 1048576).toFixed(0)} MB  sha256 ${sha.slice(0, 12)}…  halaman datar: ${flattened}`);
console.log(`[site] paket di ${dist}`);
