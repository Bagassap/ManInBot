// Menyiapkan folder `stage/` berisi backend produksi + frontend statis yang akan dibundel ke aplikasi desktop.
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const stage = path.resolve(__dirname, '..', 'stage');
const log = (m) => console.log(`[stage] ${m}`);

fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(path.join(stage, 'backend'), { recursive: true });

const skip = (src) => {
  const n = path.basename(src);
  return !(/\.tmp\d*$/.test(n) || /\.spec\.(js|d\.ts)$/.test(n) || n.endsWith('.map') || n === 'scripts' || n === 'tsbuildinfo');
};

log('menyalin dist backend');
const dist = path.join(root, 'backend', 'dist');
if (!fs.existsSync(path.join(dist, 'main.js'))) throw new Error('backend/dist belum dibangun (npx tsc -p tsconfig.build.json)');
fs.cpSync(dist, path.join(stage, 'backend', 'dist'), { recursive: true, filter: skip });

log('menyalin migrasi database');
fs.cpSync(path.join(root, 'backend', 'prisma', 'migrations'), path.join(stage, 'backend', 'prisma', 'migrations'), { recursive: true });

log('menyalin package.json dan memasang dependensi produksi');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'backend', 'package.json'), 'utf8'));
const slim = { name: 'mib-backend', version: pkg.version || '0.0.0', private: true, type: pkg.type, dependencies: pkg.dependencies };
fs.writeFileSync(path.join(stage, 'backend', 'package.json'), JSON.stringify(slim, null, 2));
if (fs.existsSync(path.join(root, 'backend', 'package-lock.json'))) {
  fs.copyFileSync(path.join(root, 'backend', 'package-lock.json'), path.join(stage, 'backend', 'package-lock.json'));
}
execSync('npm install --omit=dev --ignore-scripts --no-audit --no-fund --loglevel=error', { cwd: path.join(stage, 'backend'), stdio: 'inherit' });

log('menyalin frontend statis');
const out = path.join(root, 'frontend', 'out');
if (!fs.existsSync(path.join(out, 'index.html'))) throw new Error('frontend/out belum ada (MIB_STATIC=1 NEXT_PUBLIC_API_URL= npx next build)');
fs.cpSync(out, path.join(stage, 'frontend'), { recursive: true });

log('selesai');
