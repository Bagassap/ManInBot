// Gateway MiB: menyimpan kunci API Claude di server, sehingga aplikasi di komputer pengguna cukup memakai kode lisensi.
// Tanpa dependensi (Node 20+). Mendengarkan 127.0.0.1 saja; nginx meneruskan /ai/ ke sini.
//
// Lingkungan:  ANTHROPIC_API_KEY (wajib), PORT (4100), DATA_DIR (/var/lib/mib-gateway),
//              ALLOWED_MODELS (koma), MAX_TOKENS_CAP (64000), MAX_CONCURRENT (3), RPM (60)
import { createServer } from 'node:http';
import { LicenseStore, hashCode } from './store.mjs';

const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) {
  console.error('ANTHROPIC_API_KEY belum diatur');
  process.exit(1);
}
const PORT = Number(process.env.PORT || 4100);
const UPSTREAM = process.env.UPSTREAM || 'https://api.anthropic.com';
const ALLOWED_MODELS = (process.env.ALLOWED_MODELS || 'claude-opus-5-5,claude-sonnet-5-5').split(',').map((s) => s.trim());
const MAX_TOKENS_CAP = Number(process.env.MAX_TOKENS_CAP || 64000);
const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT || 3);
const RPM = Number(process.env.RPM || 60);
const MAX_BODY = 25 * 1024 * 1024;

const store = new LicenseStore(process.env.DATA_DIR || '/var/lib/mib-gateway');
const active = new Map(); // hash kode -> jumlah permintaan berjalan
const hits = new Map(); // hash kode -> cap waktu permintaan satu menit terakhir

const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
};
const anthropicError = (res, status, type, message) => json(res, status, { type: 'error', error: { type, message } });

function codeOf(req) {
  const k = req.headers['x-api-key'];
  if (typeof k === 'string' && k) return k.trim();
  const a = req.headers.authorization;
  return typeof a === 'string' && a.startsWith('Bearer ') ? a.slice(7).trim() : '';
}

/** Memeriksa kode; mengembalikan lisensi atau mengirim galat dan mengembalikan null. */
function authorize(req, res) {
  const code = codeOf(req);
  if (!code || code.length > 100) return anthropicError(res, 401, 'authentication_error', 'Kode lisensi diperlukan.'), null;
  const h = hashCode(code);
  const lic = store.get(h);
  if (!lic) return anthropicError(res, 401, 'authentication_error', 'Kode lisensi tidak dikenal.'), null;
  if (lic.revoked) return anthropicError(res, 403, 'permission_error', 'Kode lisensi ini sudah dicabut.'), null;
  if (lic.expiresAt && Date.now() > Date.parse(lic.expiresAt)) return anthropicError(res, 403, 'permission_error', 'Masa berlaku kode lisensi sudah habis.'), null;
  if (lic.usedTokens >= lic.quotaTokens) return anthropicError(res, 429, 'rate_limit_error', 'Kuota pemakaian kode lisensi ini sudah habis.'), null;
  return { lic, h };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let n = 0;
    req.on('data', (c) => {
      n += c.length;
      if (n > MAX_BODY) {
        reject(Object.assign(new Error('terlalu besar'), { status: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

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
        const ev = JSON.parse(tail); // respons non-stream: satu objek JSON
        take(ev.usage);
      } catch {}
      return input + output;
    },
  };
}

async function handleMessages(req, res) {
  const auth = authorize(req, res);
  if (!auth) return;
  const { h } = auth;

  const now = Date.now();
  const recent = (hits.get(h) || []).filter((t) => now - t < 60_000);
  if (recent.length >= RPM) return anthropicError(res, 429, 'rate_limit_error', 'Terlalu banyak permintaan; coba lagi sebentar.');
  if ((active.get(h) || 0) >= MAX_CONCURRENT) return anthropicError(res, 429, 'rate_limit_error', 'Terlalu banyak permintaan berjalan bersamaan.');
  recent.push(now);
  hits.set(h, recent);

  let raw;
  try {
    raw = await readBody(req);
  } catch (e) {
    return anthropicError(res, e.status || 400, 'invalid_request_error', 'Isi permintaan tidak bisa dibaca atau terlalu besar.');
  }
  let body;
  try {
    body = JSON.parse(raw.toString('utf8'));
  } catch {
    return anthropicError(res, 400, 'invalid_request_error', 'Isi permintaan bukan JSON.');
  }
  if (!ALLOWED_MODELS.includes(body.model)) return anthropicError(res, 400, 'invalid_request_error', 'Model tidak tersedia untuk kode lisensi ini.');
  if (typeof body.max_tokens !== 'number' || body.max_tokens > MAX_TOKENS_CAP) body.max_tokens = Math.min(Number(body.max_tokens) || MAX_TOKENS_CAP, MAX_TOKENS_CAP);

  const headers = { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': req.headers['anthropic-version'] || '2023-06-01' };
  if (req.headers['anthropic-beta']) headers['anthropic-beta'] = req.headers['anthropic-beta'];

  active.set(h, (active.get(h) || 0) + 1);
  const abort = new AbortController();
  res.on('close', () => abort.abort());
  const tracker = usageTracker();
  try {
    const up = await fetch(`${UPSTREAM}/v1/messages`, { method: 'POST', headers, body: JSON.stringify(body), signal: abort.signal });
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
  } catch (e) {
    if (!res.headersSent) anthropicError(res, 502, 'api_error', 'Layanan AI tidak bisa dihubungi.');
    else res.end();
  } finally {
    const used = tracker.finish();
    if (used > 0) store.addUsage(h, used);
    active.set(h, Math.max(0, (active.get(h) || 1) - 1));
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://x');
  try {
    if (req.method === 'POST' && url.pathname === '/v1/messages') return await handleMessages(req, res);
    if (req.method === 'GET' && url.pathname === '/v1/license') {
      const auth = authorize(req, res);
      if (!auth) return;
      const { lic } = auth;
      return json(res, 200, { ok: true, quotaTokens: lic.quotaTokens, usedTokens: lic.usedTokens, expiresAt: lic.expiresAt || null, note: lic.note || '' });
    }
    if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { ok: true });
    return json(res, 404, { error: 'tidak ditemukan' });
  } catch (e) {
    console.error('galat', e);
    if (!res.headersSent) json(res, 500, { error: 'galat server' });
    else res.end();
  }
});
server.requestTimeout = 0; // aliran jawaban bisa lama
server.headersTimeout = 30_000;
server.listen(PORT, '127.0.0.1', () => console.log(`gateway MiB di 127.0.0.1:${PORT}`));
