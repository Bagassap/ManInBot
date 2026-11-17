// Dashboard admin MiB: daftar akun (email), paket, pemakaian, dan pembayaran.
//
// Pengamanan berlapis:
//  1. Alamat rahasia acak (ADMIN_PATH, minimal 24 karakter). Alamat lain apa pun, termasuk /admin, menjawab 404
//     yang sama persis dengan alamat tak dikenal, jadi keberadaan dashboard tidak bisa ditebak.
//  2. Kata sandi admin (ADMIN_PASS_HASH, scrypt). Diisi lewat `mib-admin-setup` di server, tidak pernah lewat web.
//  3. Percobaan masuk dibatasi (5 per 15 menit per IP, 20 per jam total) dan dicatat di journal.
//  4. Sesi di memori (12 jam), cookie HttpOnly + Secure + SameSite=Strict yang hanya berlaku untuk alamat rahasia.
//  5. Permintaan yang mengubah data wajib dari situs yang sama (Origin diperiksa) dan memakai header khusus.
//  6. CSP ketat, noindex, tanpa cache, tidak bisa dimuat di dalam frame.
//  7. Opsional: ADMIN_IPS (dipisah koma) membatasi dashboard hanya untuk alamat IP tertentu.
import { randomBytes } from 'node:crypto';
import { checkPassword, sha } from './db.mjs';

const SESSION_MS = 12 * 3600_000;
const COOKIE = 'mib_adm';

export function createAdmin(db, { json, fail, ipOf, allow, readJson, cfg }) {
  const base = String(process.env.ADMIN_PATH || '').replace(/[^A-Za-z0-9_-]/g, '');
  const passHash = process.env.ADMIN_PASS_HASH || '';
  const ips = String(process.env.ADMIN_IPS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const enabled = base.length >= 24 && passHash.startsWith('s1$');
  const prefix = `/${base}`;
  const sessions = new Map(); // sha(token) -> kedaluwarsa

  const notFound = (res) => json(res, 404, { error: 'tidak ditemukan' }); // sama dengan router utama

  const secHeaders = {
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex, nofollow',
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  };

  const cookieOf = (req) => {
    const m = /(?:^|;\s*)mib_adm=([A-Za-z0-9]+)/.exec(String(req.headers.cookie || ''));
    return m ? m[1] : '';
  };
  const authed = (req) => {
    const t = cookieOf(req);
    if (!t) return false;
    const exp = sessions.get(sha(t));
    if (!exp) return false;
    if (exp < Date.now()) {
      sessions.delete(sha(t));
      return false;
    }
    return true;
  };
  // Path cookie mengikuti alamat yang dilihat browser (/ai/<rahasia>), bukan alamat internal setelah nginx.
  const publicBase = String(process.env.ADMIN_PUBLIC_BASE ?? '/ai').replace(/[^A-Za-z0-9_/-]/g, '');
  const cookiePath = () => `${publicBase}${prefix}`;
  const setCookie = (req, res, token, maxAge) =>
    res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=${cookiePath()}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`);

  /** Perubahan data hanya dari halaman dashboard sendiri. */
  const sameOrigin = (req) => {
    if (req.headers['x-mib-admin'] !== '1') return false;
    const o = req.headers.origin;
    if (!o) return true; // header khusus di atas sudah memaksa preflight lintas situs
    try {
      return new URL(o).host === req.headers.host;
    } catch {
      return false;
    }
  };

  const log = (req, what) => console.log(`[admin] ${what} ip=${ipOf(req)}`);

  async function login(req, res) {
    const ip = ipOf(req);
    if (!allow(`adm:${ip}`, 5, 900_000) || !allow('adm:*', 20, 3600_000)) {
      log(req, 'masuk diblokir sementara (terlalu banyak percobaan)');
      return fail(res, 429, 'Terlalu banyak percobaan. Coba lagi nanti.');
    }
    const b = await readJson(req, res);
    if (!b) return;
    const ok = typeof b.password === 'string' && b.password.length <= 200 && checkPassword(b.password, passHash);
    if (!ok) {
      log(req, 'masuk GAGAL');
      await new Promise((r) => setTimeout(r, 600));
      return fail(res, 401, 'Kata sandi salah.');
    }
    for (const [k, exp] of sessions) if (exp < Date.now()) sessions.delete(k);
    if (sessions.size >= 20) sessions.delete(sessions.keys().next().value);
    const token = randomBytes(32).toString('hex');
    sessions.set(sha(token), Date.now() + SESSION_MS);
    setCookie(req, res, token, SESSION_MS / 1000);
    log(req, 'masuk berhasil');
    json(res, 200, { ok: true });
  }

  function data(res) {
    const now = Date.now();
    const users = db.adminUsers().map((u) => ({
      email: u.email,
      name: u.name || '',
      verified: !!u.verified,
      banned: !!u.banned,
      paid: u.paid_until > now,
      paidUntil: u.paid_until > 0 ? new Date(u.paid_until).toISOString() : null,
      createdAt: new Date(u.created_at).toISOString(),
      paidCount: u.paid_count,
      paidTotal: u.paid_total,
      usedToday: u.used_today,
      used40d: u.used_40d,
      tokens40d: u.tokens_40d,
      tokensToday: u.tokens_today,
      tokensMax: u.tokens_max,
      firstCmd: u.first_cmd ? new Date(u.first_cmd).toISOString() : null,
      lastCmd: u.last_cmd ? new Date(u.last_cmd).toISOString() : null,
    }));
    const daily = db.adminDaily();
    const payments = db.adminPayments().map((p) => ({
      orderId: p.order_id,
      email: p.email,
      amount: p.amount,
      days: p.days,
      status: p.status,
      createdAt: new Date(p.created).toISOString(),
      paidAt: p.paid_at ? new Date(p.paid_at).toISOString() : null,
    }));
    const revenue = payments.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
    json(res, 200, {
      stats: {
        users: users.length,
        verified: users.filter((u) => u.verified).length,
        paidActive: users.filter((u) => u.paid).length,
        revenue,
        paymentsPaid: payments.filter((p) => p.status === 'paid').length,
      },
      config: {
        ai: !!cfg.aiKey,
        email: !!process.env.SMTP_HOST,
        payment: !!(cfg.midtransKey && cfg.priceIdr > 0),
        priceIdr: cfg.priceIdr,
        freePerDay: cfg.freePerDay,
        paidPerDay: cfg.paidPerDay,
        unlimited: cfg.unlimited,
        // Perkiraan biaya: token tercatat sudah setara harga token masukan (lihat usageTracker di server.mjs).
        priceUsdPerMTok: Number(process.env.PRICE_USD_PER_MTOK) || 2,
        usdIdr: Number(process.env.USD_IDR) || 16500,
      },
      users,
      daily,
      payments,
    });
  }

  async function action(req, res, kind) {
    const b = await readJson(req, res);
    if (!b) return;
    const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
    const u = db.userByEmail(email);
    if (!u) return fail(res, 404, 'Akun tidak ditemukan.');
    if (kind === 'grant') {
      const days = Number(b.days);
      if (!Number.isInteger(days) || days < 1 || days > 366) return fail(res, 400, 'Jumlah hari 1 sampai 366.');
      const until = db.extendPaid(u.id, days);
      log(req, `beri ${days} hari ke ${email}`);
      return json(res, 200, { ok: true, paidUntil: new Date(until).toISOString() });
    }
    if (kind === 'resetpw') {
      // Sandi sementara untuk pengguna yang lupa (tidak ada atur ulang lewat email). Semua sesi lamanya diakhiri.
      const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
      const temp = Array.from(randomBytes(12), (x) => alphabet[x % alphabet.length]).join('');
      db.setPassword(u.id, temp);
      log(req, `atur ulang sandi ${email}`);
      return json(res, 200, { ok: true, password: temp });
    }
    const banned = kind === 'ban';
    db.setBanned(email, banned);
    log(req, `${banned ? 'blokir' : 'buka blokir'} ${email}`);
    json(res, 200, { ok: true });
  }

  return {
    match: (p) => enabled && (p === prefix || p.startsWith(`${prefix}/`)),

    async handle(req, res, url) {
      for (const [k, v] of Object.entries(secHeaders)) res.setHeader(k, v);
      if (ips.length && !ips.includes(ipOf(req))) return notFound(res);
      const sub = url.pathname.slice(prefix.length) || '/';
      const route = `${req.method} ${sub}`;

      if (route === 'GET /' && !url.pathname.endsWith('/')) {
        res.writeHead(301, { Location: `${cookiePath()}/` });
        return res.end();
      }
      if (route === 'GET /') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(PAGE);
      }
      if (route === 'GET /app.js') {
        res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
        return res.end(SCRIPT);
      }
      if (req.method === 'POST' && !sameOrigin(req)) return fail(res, 403, 'Ditolak.');
      if (route === 'POST /api/login') return login(req, res);
      if (!authed(req)) return fail(res, 401, 'Belum masuk.');
      if (route === 'GET /api/data') return data(res);
      if (route === 'POST /api/logout') {
        sessions.delete(sha(cookieOf(req)));
        setCookie(req, res, 'x', 0);
        log(req, 'keluar');
        return json(res, 200, { ok: true });
      }
      if (route === 'POST /api/grant') return action(req, res, 'grant');
      if (route === 'POST /api/ban') return action(req, res, 'ban');
      if (route === 'POST /api/unban') return action(req, res, 'unban');
      if (route === 'POST /api/resetpw') return action(req, res, 'resetpw');
      return notFound(res);
    },
  };
}

const PAGE = `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>MiB · Admin</title>
<style>
:root{--bg:#050607;--sf:#0e1114;--ln:#1f2529;--fg:#e8eef0;--mu:#8a979c;--ac:#2fc6b4;--rd:#f87171;--am:#fbbf24}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
.wrap{max-width:1180px;margin:0 auto;padding:24px 16px}h1{font-size:20px;margin:0}h2{font-size:16px;margin:28px 0 10px}
.card{background:var(--sf);border:1px solid var(--ln);border-radius:14px;padding:16px}
.login{max-width:360px;margin:12vh auto}input,select{width:100%;background:var(--bg);color:var(--fg);border:1px solid var(--ln);border-radius:10px;padding:10px 12px;font:inherit}
button{background:var(--ac);color:#062420;border:0;border-radius:10px;padding:10px 14px;font:inherit;font-weight:600;cursor:pointer}
button.ghost{background:transparent;color:var(--mu);border:1px solid var(--ln);font-weight:500;padding:6px 10px}
button.ghost:hover{color:var(--fg)}.err{color:var(--rd);min-height:20px;margin:8px 0}
.top{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:16px}
.stat b{display:block;font-size:22px}.stat span{color:var(--mu);font-size:12px}
.cfg{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.pill{border:1px solid var(--ln);border-radius:99px;padding:3px 10px;font-size:12px;color:var(--mu)}
.ok{color:var(--ac)}.no{color:var(--am)}.tw{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:13px}
th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--ln);white-space:nowrap}th{color:var(--mu);font-weight:500}
.tools{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}.tools input{max-width:280px}.muted{color:var(--mu)}
.tag{font-size:11px;border-radius:6px;padding:1px 6px;border:1px solid var(--ln)}.tag.paid{color:var(--ac);border-color:var(--ac)}.tag.ban{color:var(--rd);border-color:var(--rd)}
</style></head><body>
<div class="wrap">
  <div id="login" class="login card" hidden>
    <h1>Admin MiB</h1><p class="muted">Masukkan kata sandi admin.</p>
    <form id="lf"><input id="pw" type="password" autocomplete="current-password" placeholder="Kata sandi" required>
    <div class="err" id="lerr"></div><button type="submit" style="width:100%">Masuk</button></form>
  </div>
  <div id="dash" hidden>
    <div class="top"><h1>Admin MiB</h1><div><button class="ghost" id="rf">Muat ulang</button> <button class="ghost" id="lo">Keluar</button></div></div>
    <div class="stats" id="stats"></div>
    <div class="cfg" id="cfg"></div>
    <h2>Pengguna</h2>
    <div class="tools"><input id="q" placeholder="Cari email…"><button class="ghost" id="csv">Unduh CSV</button></div>
    <div class="card tw"><table><thead><tr><th>Nama</th><th>Email</th><th>Daftar</th><th>Status</th><th>Paket</th><th>Hari ini</th><th>40 hari</th><th>Total bayar</th><th>Aksi</th></tr></thead><tbody id="ut"></tbody></table></div>
    <h2>Pemakaian per akun</h2>
    <p class="muted" style="margin:-4px 0 10px;font-size:12px">Diambil langsung dari database server MiB (data perintah disimpan 40 hari). Biaya adalah perkiraan; angka pasti ada di Claude Console.</p>
    <div class="card tw"><table><thead><tr><th>Akun</th><th>Nama</th><th>Perintah</th><th>Token tercatat</th><th>Hari ini</th><th>Perintah terbesar</th><th>Perkiraan biaya</th><th>Pertama</th><th>Terakhir</th></tr></thead><tbody id="ust"></tbody></table></div>
    <h2>Pemakaian per hari</h2>
    <div class="card tw"><table><thead><tr><th>Tanggal (WIB)</th><th>Akun aktif</th><th>Perintah</th><th>Token tercatat</th><th>Perkiraan biaya</th></tr></thead><tbody id="dt"></tbody></table></div>
    <h2>Pembayaran</h2>
    <div class="card tw"><table><thead><tr><th>Waktu</th><th>Email</th><th>Order</th><th>Jumlah</th><th>Hari</th><th>Status</th><th>Lunas</th></tr></thead><tbody id="pt"></tbody></table></div>
  </div>
</div>
<script src="app.js"></script>
</body></html>`;

const SCRIPT = `(() => {
const $ = (id) => document.getElementById(id);
const H = { 'Content-Type': 'application/json', 'X-MiB-Admin': '1' };
const rp = (n) => 'Rp' + Number(n || 0).toLocaleString('id-ID');
const dt = (s) => (s ? new Date(s).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-');
const d = (s) => (s ? new Date(s).toLocaleDateString('id-ID', { dateStyle: 'medium' }) : '-');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let DATA = null;
const num = (n) => Number(n || 0).toLocaleString('id-ID');
const cost = (tokens) => {
  const usd = (Number(tokens || 0) / 1e6) * DATA.config.priceUsdPerMTok;
  return '±US$' + usd.toFixed(2) + ' (' + rp(Math.round((usd * DATA.config.usdIdr) / 100) * 100) + ')';
};

async function post(p, body) {
  const r = await fetch('api/' + p, { method: 'POST', headers: H, body: JSON.stringify(body || {}), credentials: 'same-origin' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Gagal');
  return j;
}
async function load() {
  const r = await fetch('api/data', { headers: { 'X-MiB-Admin': '1' }, credentials: 'same-origin' });
  if (r.status === 401) { $('dash').hidden = true; $('login').hidden = false; $('pw').focus(); return; }
  DATA = await r.json();
  $('login').hidden = true; $('dash').hidden = false;
  render();
}
function render() {
  const s = DATA.stats, c = DATA.config;
  $('stats').innerHTML = [
    ['Akun terdaftar', s.users], ['Terverifikasi', s.verified], ['Berbayar aktif', s.paidActive],
    ['Pembayaran lunas', s.paymentsPaid], ['Total pendapatan', rp(s.revenue)],
    ['Token 40 hari', num(DATA.users.reduce((a, u) => a + u.tokens40d, 0))],
    ['Perkiraan biaya AI', cost(DATA.users.reduce((a, u) => a + u.tokens40d, 0))],
  ].map(([k, v]) => '<div class="card stat"><span>' + k + '</span><b>' + esc(v) + '</b></div>').join('');
  const pill = (ok, t) => '<span class="pill ' + (ok ? 'ok' : 'no') + '">' + (ok ? '● ' : '○ ') + t + '</span>';
  $('cfg').innerHTML = pill(c.ai, 'Layanan AI') + pill(c.email, 'Email verifikasi') + pill(c.payment, 'Pembayaran' + (c.priceIdr ? ' ' + rp(c.priceIdr) : '')) +
    (c.unlimited ? '<span class="pill ok">● Uji coba: perintah tanpa batas</span>' : '<span class="pill">Gratis ' + c.freePerDay + '/hari · Berbayar ' + c.paidPerDay + '/hari</span>');
  const q = $('q').value.trim().toLowerCase();
  const users = DATA.users.filter((u) => !q || u.email.includes(q));
  $('ut').innerHTML = users.length ? users.map((u) =>
    '<tr><td>' + (esc(u.name) || '<span class="muted">-</span>') + '</td><td>' + esc(u.email) + '</td><td>' + d(u.createdAt) + '</td><td>' +
    (u.banned ? '<span class="tag ban">Diblokir</span>' : u.verified ? 'Terverifikasi' : '<span class="muted">Belum verifikasi</span>') +
    '</td><td>' + (u.paid ? '<span class="tag paid">Berbayar</span> s.d. ' + d(u.paidUntil) : 'Gratis') +
    '</td><td>' + u.usedToday + '</td><td>' + u.used40d + '</td><td>' + rp(u.paidTotal) + (u.paidCount ? ' (' + u.paidCount + 'x)' : '') +
    '</td><td><button class="ghost" data-a="grant" data-e="' + esc(u.email) + '">+ Hari</button> <button class="ghost" data-a="' + (u.banned ? 'unban' : 'ban') + '" data-e="' + esc(u.email) + '">' + (u.banned ? 'Buka blokir' : 'Blokir') + '</button> <button class="ghost" data-a="resetpw" data-e="' + esc(u.email) + '">Sandi baru</button></td></tr>'
  ).join('') : '<tr><td colspan="9" class="muted">Belum ada akun.</td></tr>';
  $('pt').innerHTML = DATA.payments.length ? DATA.payments.map((p) =>
    '<tr><td>' + dt(p.createdAt) + '</td><td>' + esc(p.email) + '</td><td class="muted">' + esc(p.orderId) + '</td><td>' + rp(p.amount) +
    '</td><td>' + p.days + '</td><td>' + (p.status === 'paid' ? '<span class="tag paid">Lunas</span>' : esc(p.status)) + '</td><td>' + dt(p.paidAt) + '</td></tr>'
  ).join('') : '<tr><td colspan="7" class="muted">Belum ada pembayaran.</td></tr>';
  const byUse = users.slice().sort((a, b) => b.tokens40d - a.tokens40d);
  $('ust').innerHTML = byUse.length ? byUse.map((u) =>
    '<tr><td>' + esc(u.email) + '</td><td>' + (esc(u.name) || '<span class="muted">-</span>') + '</td><td>' + u.used40d + '</td><td>' + num(u.tokens40d) +
    '</td><td>' + u.usedToday + ' perintah · ' + num(u.tokensToday) + '</td><td>' + (u.tokensMax ? num(u.tokensMax) : '-') + '</td><td>' + (u.tokens40d ? cost(u.tokens40d) : '-') +
    '</td><td>' + (u.firstCmd ? dt(u.firstCmd) : '<span class="muted">belum ada</span>') + '</td><td>' + (u.lastCmd ? dt(u.lastCmd) : '-') + '</td></tr>'
  ).join('') : '<tr><td colspan="9" class="muted">Belum ada akun.</td></tr>';
  $('dt').innerHTML = DATA.daily.length ? DATA.daily.map((x) =>
    '<tr><td>' + esc(x.day) + '</td><td>' + x.users + '</td><td>' + x.commands + '</td><td>' + num(x.tokens) + '</td><td>' + cost(x.tokens) + '</td></tr>'
  ).join('') : '<tr><td colspan="5" class="muted">Belum ada pemakaian.</td></tr>';
}
$('lf').addEventListener('submit', async (e) => {
  e.preventDefault(); $('lerr').textContent = '';
  try { await post('login', { password: $('pw').value }); $('pw').value = ''; await load(); }
  catch (err) { $('lerr').textContent = err.message; }
});
$('lo').addEventListener('click', async () => { await post('logout').catch(() => {}); location.reload(); });
$('rf').addEventListener('click', load);
$('q').addEventListener('input', render);
$('ut').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-a]'); if (!b) return;
  const email = b.dataset.e, a = b.dataset.a;
  try {
    if (a === 'grant') {
      const days = Number(prompt('Tambah berapa hari paket berbayar untuk ' + email + '?', '30'));
      if (!days) return;
      await post('grant', { email, days });
    } else if (a === 'resetpw') {
      if (!confirm('Buat kata sandi sementara untuk ' + email + '? Kata sandi lamanya tidak berlaku lagi.')) return;
      const r = await post('resetpw', { email });
      prompt('Kata sandi sementara untuk ' + email + ' (salin dan berikan kepada pengguna):', r.password);
    } else {
      if (!confirm((a === 'ban' ? 'Blokir ' : 'Buka blokir ') + email + '?')) return;
      await post(a, { email });
    }
    await load();
  } catch (err) { alert(err.message); }
});
$('csv').addEventListener('click', () => {
  const rows = [['nama', 'email', 'daftar', 'terverifikasi', 'diblokir', 'berbayar_sampai', 'total_bayar']].concat(
    DATA.users.map((u) => [u.name, u.email, u.createdAt, u.verified, u.banned, u.paidUntil || '', u.paidTotal]));
  const csv = rows.map((r) => r.map((v) => { let t = String(v); if (/^[=+@-]/.test(t)) t = "'" + t; return '"' + t.replace(/"/g, '""') + '"'; }).join(',')).join('\\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = 'pengguna-mib.csv'; a.click();
});
load();
})();`;
