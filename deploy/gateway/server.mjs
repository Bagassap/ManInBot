// Gateway MiB: akun, kuota perintah harian, pembayaran Midtrans, dan perantara ke layanan AI.
// Kunci layanan AI hanya ada di sini; aplikasi di komputer pengguna memegang token sesi akun MiB.
// Tanpa dependensi selain nodemailer (Node 22+, memakai node:sqlite). Mendengarkan 127.0.0.1; nginx meneruskan /ai/ ke sini.
import { createHash, timingSafeEqual } from 'node:crypto';
import { Db } from './db.mjs';
import { mailReady, sendCode } from './mail.mjs';

const env = process.env;
const num = (k, d) => (Number.isFinite(Number(env[k])) && env[k] !== '' && env[k] !== undefined ? Number(env[k]) : d);

export const CFG = {
  aiKey: env.ANTHROPIC_API_KEY,
  upstream: env.UPSTREAM || 'https://api.anthropic.com',
  models: (env.ALLOWED_MODELS || 'claude-opus-5-5,claude-sonnet-5-5').split(',').map((s) => s.trim()),
  maxTokensCap: num('MAX_TOKENS_CAP', 64000),
  maxConcurrent: num('MAX_CONCURRENT', 3),
  rpm: num('RPM', 90),
  freePerDay: num('FREE_PER_DAY', 3),
  paidPerDay: num('PAID_PER_DAY', 30),
  freeCmdTokens: num('FREE_CMD_TOKENS', 150_000),
  paidCmdTokens: num('PAID_CMD_TOKENS', 600_000),
  planDays: num('PLAN_DAYS', 30),
  priceIdr: num('PLAN_PRICE_IDR', 0),
  midtransKey: env.MIDTRANS_SERVER_KEY || '',
  midtransSnap: env.MIDTRANS_SNAP_URL || (env.MIDTRANS_PRODUCTION === '1' ? 'https://app.midtrans.com/snap/v1/transactions' : 'https://app.sandbox.midtrans.com/snap/v1/transactions'),
  midtransApi: env.MIDTRANS_API_URL || (env.MIDTRANS_PRODUCTION === '1' ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com'),
  maxBody: 25 * 1024 * 1024,
};

export function createGateway(db) {
  const active = new Map(); // id pengguna -> permintaan AI yang sedang berjalan
  const hits = new Map(); // kunci pembatas -> daftar cap waktu

  /** Pembatas laju sederhana di memori. true = lolos. */
  const allow = (key, max, windowMs) => {
    const now = Date.now();
    const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (list.length >= max) {
      hits.set(key, list);
      return false;
    }
    list.push(now);
    hits.set(key, list);
    return true;
  };
  const sweep = setInterval(() => {
    for (const [k, l] of hits) if (!l.length || Date.now() - l[l.length - 1] > 3600_000) hits.delete(k);
    db.purge();
  }, 600_000);
  sweep.unref?.();

  const json = (res, status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  };
  const fail = (res, status, message, extra = {}) => json(res, status, { error: message, ...extra });
  const aiError = (res, status, type, message) => json(res, status, { type: 'error', error: { type, message } });

  const ipOf = (req) => String(req.headers['x-real-ip'] || req.socket.remoteAddress || '');
  const tokenOf = (req) => {
    const k = req.headers['x-api-key'];
    if (typeof k === 'string' && k) return k.trim();
    const a = req.headers.authorization;
    return typeof a === 'string' && a.startsWith('Bearer ') ? a.slice(7).trim() : '';
  };

  function readBody(req, limit) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      let n = 0;
      req.on('data', (c) => {
        n += c.length;
        if (n > limit) {
          reject(Object.assign(new Error('terlalu besar'), { status: 413 }));
          req.destroy();
        } else chunks.push(c);
      });
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });
  }
  async function readJson(req, res) {
    try {
      const raw = await readBody(req, 64 * 1024);
      return raw.length ? JSON.parse(raw.toString('utf8')) : {};
    } catch {
      fail(res, 400, 'Isi permintaan tidak valid.');
      return null;
    }
  }

  const planInfo = () => ({
    freePerDay: CFG.freePerDay,
    paidPerDay: CFG.paidPerDay,
    days: CFG.planDays,
    priceIdr: CFG.priceIdr,
    canPay: !!(CFG.midtransKey && CFG.priceIdr > 0),
  });
  const isPaid = (u) => u.paid_until > Date.now();
  const accountView = (u) => {
    const paid = isPaid(u);
    return {
      email: u.email,
      paid,
      paidUntil: paid ? new Date(u.paid_until).toISOString() : null,
      usedToday: db.usedToday(u.id),
      limitToday: paid ? CFG.paidPerDay : CFG.freePerDay,
      plan: planInfo(),
    };
  };

  /** Pengguna dari token sesi; mengirim galat dan mengembalikan null bila tidak sah. */
  function sessionUser(req, res, ai = false) {
    const err = (status, type, msg) => (ai ? aiError(res, status, type, msg) : fail(res, status, msg));
    const token = tokenOf(req);
    if (!token) return err(401, 'authentication_error', 'Masuk ke akun MiB terlebih dahulu.'), null;
    const u = db.userBySession(token);
    if (!u) return err(401, 'authentication_error', 'Sesi akun MiB sudah berakhir. Masuk kembali di Pengaturan.'), null;
    if (u.banned) return err(403, 'permission_error', 'Akun ini dinonaktifkan.'), null;
    return u;
  }

  const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
  const normEmail = (v) => (typeof v === 'string' ? v.trim().toLowerCase().slice(0, 120) : '');
  const validPassword = (p) => typeof p === 'string' && p.length >= 8 && p.length <= 100;

  // ---------------- akun ----------------
  async function register(req, res) {
    const b = await readJson(req, res);
    if (!b) return;
    const email = normEmail(b.email);
    if (!EMAIL_RE.test(email)) return fail(res, 400, 'Alamat email tidak valid.');
    if (!validPassword(b.password)) return fail(res, 400, 'Kata sandi minimal 8 karakter.');
    if (!allow(`reg:${ipOf(req)}`, 10, 3600_000) || !allow(`regm:${email}`, 5, 3600_000)) return fail(res, 429, 'Terlalu sering mendaftar. Coba lagi nanti.');
    const existing = db.userByEmail(email);
    if (existing?.verified) return fail(res, 409, 'Email ini sudah terdaftar. Silakan masuk.');
    if (!mailReady()) return fail(res, 503, 'Pengiriman email belum diatur di server MiB.');
    db.upsertUnverified(email, b.password);
    try {
      await sendCode(email, 'verify', db.newCode(email, 'verify'));
    } catch (e) {
      console.error('email gagal', e?.message);
      return fail(res, 502, 'Gagal mengirim email verifikasi. Coba lagi nanti.');
    }
    json(res, 200, { ok: true, needVerify: true });
  }

  async function verify(req, res) {
    const b = await readJson(req, res);
    if (!b) return;
    const email = normEmail(b.email);
    if (!allow(`ver:${ipOf(req)}`, 30, 3600_000)) return fail(res, 429, 'Terlalu banyak percobaan. Coba lagi nanti.');
    const u = db.userByEmail(email);
    if (!u || !db.consumeCode(email, 'verify', b.code)) return fail(res, 400, 'Kode salah atau sudah kedaluwarsa.');
    db.markVerified(u.id);
    json(res, 200, { ok: true, token: db.newSession(u.id), account: accountView(db.userById(u.id)) });
  }

  async function login(req, res) {
    const b = await readJson(req, res);
    if (!b) return;
    const email = normEmail(b.email);
    if (!allow(`log:${ipOf(req)}`, 30, 900_000) || !allow(`logm:${email}`, 10, 900_000)) return fail(res, 429, 'Terlalu banyak percobaan masuk. Coba lagi 15 menit lagi.');
    const u = db.userByEmail(email);
    if (!u || typeof b.password !== 'string' || !db.verifyPassword(u, b.password)) return fail(res, 401, 'Email atau kata sandi salah.');
    if (u.banned) return fail(res, 403, 'Akun ini dinonaktifkan.');
    if (!u.verified) {
      if (mailReady()) await sendCode(email, 'verify', db.newCode(email, 'verify')).catch(() => {});
      return fail(res, 403, 'Email belum diverifikasi. Kode baru sudah dikirim ke email Anda.', { needVerify: true });
    }
    json(res, 200, { ok: true, token: db.newSession(u.id), account: accountView(u) });
  }

  async function forgot(req, res) {
    const b = await readJson(req, res);
    if (!b) return;
    const email = normEmail(b.email);
    if (!allow(`fg:${ipOf(req)}`, 10, 3600_000) || !allow(`fgm:${email}`, 3, 3600_000)) return fail(res, 429, 'Terlalu sering. Coba lagi nanti.');
    const u = db.userByEmail(email);
    if (u?.verified && mailReady()) await sendCode(email, 'reset', db.newCode(email, 'reset')).catch((e) => console.error('email gagal', e?.message));
    json(res, 200, { ok: true }); // jawaban sama untuk email yang tidak terdaftar
  }

  async function reset(req, res) {
    const b = await readJson(req, res);
    if (!b) return;
    const email = normEmail(b.email);
    if (!validPassword(b.password)) return fail(res, 400, 'Kata sandi minimal 8 karakter.');
    if (!allow(`rs:${ipOf(req)}`, 30, 3600_000)) return fail(res, 429, 'Terlalu banyak percobaan. Coba lagi nanti.');
    const u = db.userByEmail(email);
    if (!u || !db.consumeCode(email, 'reset', b.code)) return fail(res, 400, 'Kode salah atau sudah kedaluwarsa.');
    db.setPassword(u.id, b.password);
    json(res, 200, { ok: true });
  }

  // ---------------- pembayaran ----------------
  async function checkout(req, res) {
    const u = sessionUser(req, res);
    if (!u) return;
    if (!planInfo().canPay) return fail(res, 503, 'Pembayaran belum tersedia.');
    if (!allow(`co:${u.id}`, 10, 3600_000)) return fail(res, 429, 'Terlalu sering membuat pembayaran. Coba lagi nanti.');
    const orderId = `MIB-${u.id}-${Date.now().toString(36)}`;
    try {
      const r = await fetch(CFG.midtransSnap, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Basic ${Buffer.from(`${CFG.midtransKey}:`).toString('base64')}` },
        body: JSON.stringify({
          transaction_details: { order_id: orderId, gross_amount: CFG.priceIdr },
          item_details: [{ id: 'mib-bulanan', price: CFG.priceIdr, quantity: 1, name: `MiB ${CFG.planDays} hari (${CFG.paidPerDay} perintah/hari)` }],
          customer_details: { email: u.email },
        }),
        signal: AbortSignal.timeout(15_000),
      });
      const body = await r.json().catch(() => null);
      if (!r.ok || !body?.redirect_url) throw new Error(`midtrans ${r.status}`);
      db.createPayment(orderId, u.id, CFG.priceIdr, CFG.planDays);
      json(res, 200, { ok: true, url: body.redirect_url, orderId });
    } catch (e) {
      console.error('checkout gagal', e?.message);
      fail(res, 502, 'Tidak bisa membuat pembayaran sekarang. Coba lagi nanti.');
    }
  }

  const safeEq = (a, b) => {
    const x = Buffer.from(String(a));
    const y = Buffer.from(String(b));
    return x.length === y.length && timingSafeEqual(x, y);
  };

  /** Notifikasi Midtrans: tanda tangan diperiksa, lalu status dikonfirmasi langsung ke Midtrans sebelum akun diaktifkan. */
  async function payNotify(req, res) {
    const b = await readJson(req, res);
    if (!b) return;
    const { order_id: orderId, status_code: sc, gross_amount: gross, signature_key: sig } = b;
    if (![orderId, sc, gross, sig].every((v) => typeof v === 'string') || !CFG.midtransKey) return fail(res, 400, 'bad');
    const expected = createHash('sha512').update(orderId + sc + gross + CFG.midtransKey).digest('hex');
    if (!safeEq(expected, sig)) return fail(res, 403, 'signature');
    const p = db.payment(orderId);
    if (!p) return json(res, 200, { ok: true }); // pesanan yang bukan milik kita: abaikan agar Midtrans tidak mengulang
    try {
      const r = await fetch(`${CFG.midtransApi}/v2/${encodeURIComponent(orderId)}/status`, {
        headers: { Accept: 'application/json', Authorization: `Basic ${Buffer.from(`${CFG.midtransKey}:`).toString('base64')}` },
        signal: AbortSignal.timeout(15_000),
      });
      const s = await r.json();
      const amountOk = Math.round(Number(s.gross_amount)) === p.amount;
      const ok = s.transaction_status === 'settlement' || (s.transaction_status === 'capture' && s.fraud_status === 'accept');
      if (ok && amountOk) db.settle(orderId);
      else if (['deny', 'cancel', 'expire', 'failure'].includes(s.transaction_status)) db.failPayment(orderId, s.transaction_status);
    } catch (e) {
      console.error('verifikasi pembayaran gagal', e?.message);
      return fail(res, 500, 'retry'); // Midtrans akan mengirim ulang
    }
    json(res, 200, { ok: true });
  }

  // ---------------- perantara layanan AI ----------------
  /** Menjumlah pemakaian token dari aliran SSE atau JSON biasa, tanpa mengubah isi yang diteruskan. */
  function usageTracker() {
    let tail = '';
    let input = 0;
    let output = 0;
    const take = (u) => {
      if (!u) return;
      if (typeof u.input_tokens === 'number') input = Math.max(input, u.input_tokens + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0));
      if (typeof u.output_tokens === 'number') output = Math.max(output, u.output_tokens);
    };
    return {
      feed(chunk) {
        tail += Buffer.from(chunk).toString('utf8');
        let i;
        while ((i = tail.indexOf('\n')) >= 0) {
          const line = tail.slice(0, i).trim();
          tail = tail.slice(i + 1);
          if (line.startsWith('data:')) {
            try {
              const ev = JSON.parse(line.slice(5));
              take(ev.usage);
              take(ev.message?.usage);
            } catch {}
          }
        }
        if (tail.length > 1_000_000) tail = tail.slice(-100_000);
      },
      finish() {
        try {
          take(JSON.parse(tail).usage); // respons non-stream: satu objek JSON
        } catch {}
        return input + output;
      },
    };
  }

  const PLAN_HINT = () => (planInfo().canPay ? ' Upgrade ke paket berbayar di Pengaturan > Akun MiB.' : '');

  async function proxyMessages(req, res) {
    const u = sessionUser(req, res, true);
    if (!u) return;
    if (!CFG.aiKey) return aiError(res, 503, 'api_error', 'Layanan AI belum dikonfigurasi di server.');

    const cmdId = String(req.headers['x-mib-command'] || '');
    if (!/^[A-Za-z0-9-]{8,64}$/.test(cmdId)) return aiError(res, 400, 'invalid_request_error', 'Versi aplikasi MiB terlalu lama. Perbarui aplikasi.');

    const paid = isPaid(u);
    if (!allow(`rpm:${u.id}`, CFG.rpm, 60_000)) return aiError(res, 429, 'rate_limit_error', 'Terlalu banyak permintaan; coba lagi sebentar.');
    if ((active.get(u.id) || 0) >= CFG.maxConcurrent) return aiError(res, 429, 'rate_limit_error', 'Terlalu banyak permintaan berjalan bersamaan.');

    let raw;
    try {
      raw = await readBody(req, CFG.maxBody);
    } catch (e) {
      return aiError(res, e.status || 400, 'invalid_request_error', 'Isi permintaan tidak bisa dibaca atau terlalu besar.');
    }
    let body;
    try {
      body = JSON.parse(raw.toString('utf8'));
    } catch {
      return aiError(res, 400, 'invalid_request_error', 'Isi permintaan bukan JSON.');
    }
    if (!CFG.models.includes(body.model)) return aiError(res, 400, 'invalid_request_error', 'Model tidak tersedia.');
    body.max_tokens = Math.min(Number(body.max_tokens) || CFG.maxTokensCap, CFG.maxTokensCap);

    const perDay = paid ? CFG.paidPerDay : CFG.freePerDay;
    const gate = db.beginCommand(u.id, cmdId, perDay, paid ? CFG.paidCmdTokens : CFG.freeCmdTokens);
    if (!gate.ok) {
      return gate.reason === 'daily'
        ? aiError(res, 429, 'rate_limit_error', `Batas ${perDay} perintah hari ini sudah habis${paid ? '' : ' (paket gratis)'}. Kuota diperbarui besok pukul 00.00 WIB.${paid ? '' : PLAN_HINT()}`)
        : aiError(res, 429, 'rate_limit_error', 'Perintah ini sudah memakai batas pemrosesan maksimum. Pecah menjadi perintah yang lebih kecil.');
    }

    const headers = { 'content-type': 'application/json', 'x-api-key': CFG.aiKey, 'anthropic-version': req.headers['anthropic-version'] || '2023-06-01' };
    if (req.headers['anthropic-beta']) headers['anthropic-beta'] = req.headers['anthropic-beta'];

    active.set(u.id, (active.get(u.id) || 0) + 1);
    const abort = new AbortController();
    res.on('close', () => abort.abort());
    const tracker = usageTracker();
    try {
      const up = await fetch(`${CFG.upstream}/v1/messages`, { method: 'POST', headers, body: JSON.stringify(body), signal: abort.signal });
      const out = { 'Content-Type': up.headers.get('content-type') || 'application/json', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' };
      const rid = up.headers.get('request-id');
      if (rid) out['request-id'] = rid;
      res.writeHead(up.status, out);
      if (up.body) {
        for await (const chunk of up.body) {
          tracker.feed(chunk);
          if (!res.write(chunk)) await new Promise((r) => res.once('drain', r));
        }
      }
      res.end();
    } catch {
      if (!res.headersSent) aiError(res, 502, 'api_error', 'Layanan AI tidak bisa dihubungi.');
      else res.end();
    } finally {
      const used = tracker.finish();
      if (used > 0) db.addTokens(u.id, cmdId, used);
      active.set(u.id, Math.max(0, (active.get(u.id) || 1) - 1));
    }
  }

  // ---------------- router ----------------
  return async (req, res) => {
    const url = new URL(req.url || '/', 'http://x');
    const route = `${req.method} ${url.pathname}`;
    try {
      switch (route) {
        case 'POST /v1/messages':
          return await proxyMessages(req, res);
        case 'GET /v1/plan':
          return json(res, 200, planInfo());
        case 'POST /v1/account/register':
          return await register(req, res);
        case 'POST /v1/account/verify':
          return await verify(req, res);
        case 'POST /v1/account/login':
          return await login(req, res);
        case 'POST /v1/account/forgot':
          return await forgot(req, res);
        case 'POST /v1/account/reset':
          return await reset(req, res);
        case 'GET /v1/account': {
          const u = sessionUser(req, res);
          return u && json(res, 200, accountView(u));
        }
        case 'POST /v1/account/logout': {
          const t = tokenOf(req);
          if (t) db.endSession(t);
          return json(res, 200, { ok: true });
        }
        case 'POST /v1/account/checkout':
          return await checkout(req, res);
        case 'POST /v1/pay/notify':
          return await payNotify(req, res);
        case 'GET /health':
          return json(res, 200, { ok: true });
        default:
          return json(res, 404, { error: 'tidak ditemukan' });
      }
    } catch (e) {
      console.error('galat', e);
      if (!res.headersSent) json(res, 500, { error: 'galat server' });
      else res.end();
    }
  };
}
