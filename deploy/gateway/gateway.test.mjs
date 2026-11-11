import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
process.env.DEV_LOG_CODES = '1';
process.env.ANTHROPIC_API_KEY = 'sk-ant-REAL-SECRET';
process.env.UPSTREAM = 'http://127.0.0.1:4391';
process.env.MIDTRANS_SERVER_KEY = 'SB-Mid-server-TEST';
process.env.MIDTRANS_SNAP_URL = 'http://127.0.0.1:4392/snap';
process.env.MIDTRANS_API_URL = 'http://127.0.0.1:4392';
process.env.PLAN_PRICE_IDR = '99000';
process.env.FREE_PER_DAY = '3';
process.env.PAID_PER_DAY = '30';
process.env.FREE_CMD_TOKENS = '1000';
const { createGateway } = await import('./server.mjs');
const { Db } = await import('./db.mjs');

let lastKey = '';
let midStatus = 'pending';
let midAmount = '99000.00';
const fakeAI = createServer((req, res) => {
  lastKey = req.headers['x-api-key'];
  req.resume();
  req.on('end', () => {
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.write('data: {"type":"message_start","message":{"usage":{"input_tokens":100,"output_tokens":1}}}\n\n');
    res.end('data: {"type":"message_delta","usage":{"output_tokens":50}}\n\n');
  });
}).listen(4391);
const fakeMid = createServer((req, res) => {
  req.resume();
  req.on('end', () => {
    res.setHeader('content-type', 'application/json');
    if (req.url === '/snap') return res.end(JSON.stringify({ token: 't', redirect_url: 'https://pay.example/abc' }));
    res.end(JSON.stringify({ transaction_status: midStatus, gross_amount: midAmount, fraud_status: 'accept' }));
  });
}).listen(4392);

const db = new Db(':memory:');
const gw = createServer(createGateway(db)).listen(4390);
const B = 'http://127.0.0.1:4390';
const post = (p, body, h = {}) => fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json', ...h }, body: JSON.stringify(body) });
const jr = async (r) => ({ s: r.status, ...(await r.json().catch(() => ({}))) });
const log = [];
const ok = (name, cond, extra = '') => log.push(`${cond ? 'LULUS' : 'GAGAL'} ${name} ${extra}`);
const origLog = console.log;
let captured = '';
console.log = (...a) => {
  captured += a.join(' ') + '\n';
};

// --- daftar dan verifikasi
ok('daftar email buruk ditolak', (await jr(await post('/v1/account/register', { email: 'x', password: '12345678' }))).s === 400);
ok('daftar sandi pendek ditolak', (await jr(await post('/v1/account/register', { email: 'a@b.co', password: '123' }))).s === 400);
ok('daftar benar', (await jr(await post('/v1/account/register', { email: 'Budi@Kantor.id', password: 'rahasia123' }))).s === 200);
ok('login sebelum verifikasi ditolak', (await jr(await post('/v1/account/login', { email: 'budi@kantor.id', password: 'rahasia123' }))).s === 403);
const codes = [...captured.matchAll(/\[kode-uji\] budi@kantor\.id verify (\d{6})/g)].map((m) => m[1]);
ok('kode dikirim (log uji)', codes.length >= 1);
ok('kode salah ditolak', (await jr(await post('/v1/account/verify', { email: 'budi@kantor.id', code: '000000' }))).s === 400);
const v = await jr(await post('/v1/account/verify', { email: 'budi@kantor.id', code: codes.at(-1) }));
ok('verifikasi benar -> token', v.s === 200 && v.token?.startsWith('mibs_'));
const T = v.token;
const A = { 'x-api-key': T };
ok('kode tidak bisa dipakai dua kali', (await jr(await post('/v1/account/verify', { email: 'budi@kantor.id', code: codes.at(-1) }))).s === 400);
ok('daftar ulang email terverifikasi -> 409', (await jr(await post('/v1/account/register', { email: 'budi@kantor.id', password: 'lain12345' }))).s === 409);
ok('login salah sandi', (await jr(await post('/v1/account/login', { email: 'budi@kantor.id', password: 'salah' }))).s === 401);
const st = await jr(await fetch(B + '/v1/account', { headers: A }));
ok('status akun gratis 0/3', st.s === 200 && !st.paid && st.limitToday === 3 && st.usedToday === 0, JSON.stringify({ u: st.usedToday, l: st.limitToday }));

// --- kuota gratis: 3 perintah per hari
const msg = (cmd, tok = T) =>
  fetch(B + '/v1/messages', { method: 'POST', headers: { 'x-api-key': tok, 'x-mib-command': cmd, 'content-type': 'application/json' }, body: JSON.stringify({ model: 'claude-opus-5-5', max_tokens: 10, stream: true, messages: [] }) });
ok('tanpa token ditolak', (await fetch(B + '/v1/messages', { method: 'POST', body: '{}' })).status === 401);
ok('tanpa header perintah ditolak', (await fetch(B + '/v1/messages', { method: 'POST', headers: { ...A, 'content-type': 'application/json' }, body: JSON.stringify({ model: 'claude-opus-5-5', messages: [] }) })).status === 400);
const r1 = await msg('cmd-aaaaaaaa');
await r1.text();
ok('perintah 1 lolos dan kunci asli ke upstream', r1.status === 200 && lastKey === 'sk-ant-REAL-SECRET');
await (await msg('cmd-aaaaaaaa')).text();
ok('panggilan ke-2 pada perintah yang SAMA tidak menambah hitungan', db.usedToday(1) === 1);
await (await msg('cmd-bbbbbbbb')).text();
await (await msg('cmd-cccccccc')).text();
ok('3 perintah terpakai', db.usedToday(1) === 3);
const r4 = await msg('cmd-dddddddd');
const b4 = await r4.json();
ok('perintah ke-4 ditolak 429 + pesan Indonesia', r4.status === 429 && /3 perintah/.test(b4.error.message), b4.error.message);
ok('perintah ke-4 tidak tercatat', db.usedToday(1) === 3);
for (let i = 0; i < 8; i++) await (await msg('cmd-aaaaaaaa')).text();
const rcap = await msg('cmd-aaaaaaaa');
const bcap = await rcap.json();
ok('batas token per perintah', rcap.status === 429 && /pemrosesan maksimum/.test(bcap.error.message), bcap.error.message);

// --- bayar
const co = await jr(await post('/v1/account/checkout', {}, A));
ok('checkout -> url pembayaran', co.s === 200 && co.url === 'https://pay.example/abc' && co.orderId?.startsWith('MIB-1-'));
const sign = (o, sc, g) => createHash('sha512').update(o + sc + g + 'SB-Mid-server-TEST').digest('hex');
ok('notifikasi tanda tangan palsu ditolak', (await jr(await post('/v1/pay/notify', { order_id: co.orderId, status_code: '200', gross_amount: '99000.00', signature_key: 'palsu' }))).s === 403);
midStatus = 'pending';
await post('/v1/pay/notify', { order_id: co.orderId, status_code: '200', gross_amount: '99000.00', signature_key: sign(co.orderId, '200', '99000.00') });
ok('belum lunas -> belum aktif', !(await jr(await fetch(B + '/v1/account', { headers: A }))).paid);
midStatus = 'settlement';
midAmount = '1000.00';
await post('/v1/pay/notify', { order_id: co.orderId, status_code: '200', gross_amount: '1000.00', signature_key: sign(co.orderId, '200', '1000.00') });
ok('nominal tidak cocok -> tidak aktif', !(await jr(await fetch(B + '/v1/account', { headers: A }))).paid);
midAmount = '99000.00';
const n = await jr(await post('/v1/pay/notify', { order_id: co.orderId, status_code: '200', gross_amount: '99000.00', signature_key: sign(co.orderId, '200', '99000.00') }));
const st2 = await jr(await fetch(B + '/v1/account', { headers: A }));
ok('lunas -> paket berbayar aktif 30/hari', n.s === 200 && st2.paid && st2.limitToday === 30 && !!st2.paidUntil, JSON.stringify({ p: st2.paid, l: st2.limitToday }));
const until1 = st2.paidUntil;
await post('/v1/pay/notify', { order_id: co.orderId, status_code: '200', gross_amount: '99000.00', signature_key: sign(co.orderId, '200', '99000.00') });
ok('notifikasi ganda tidak memperpanjang dua kali', (await jr(await fetch(B + '/v1/account', { headers: A }))).paidUntil === until1);
const r5 = await msg('cmd-eeeeeeee');
await r5.text();
ok('setelah bayar, perintah ke-4 hari ini lolos', r5.status === 200);

// --- reset sandi dan keamanan
ok('lupa sandi email tak dikenal tetap 200 (tak bocor)', (await jr(await post('/v1/account/forgot', { email: 'tidakada@x.id' }))).s === 200);
await post('/v1/account/forgot', { email: 'budi@kantor.id' });
const rc = [...captured.matchAll(/budi@kantor\.id reset (\d{6})/g)].map((m) => m[1]).at(-1);
ok('reset sandi', (await jr(await post('/v1/account/reset', { email: 'budi@kantor.id', code: rc, password: 'baru123456' }))).s === 200);
ok('token lama mati setelah reset', (await fetch(B + '/v1/account', { headers: A })).status === 401);
const l2 = await jr(await post('/v1/account/login', { email: 'budi@kantor.id', password: 'baru123456' }));
ok('login dengan sandi baru', l2.s === 200 && !!l2.token);
db.setBanned('budi@kantor.id', true);
ok('akun diblokir ditolak', (await fetch(B + '/v1/account', { headers: { 'x-api-key': l2.token } })).status === 403);
ok('plan publik', (await jr(await fetch(B + '/v1/plan'))).priceIdr === 99000);

console.log = origLog;
console.log(log.join('\n'));
console.log(`\n${log.filter((l) => l.startsWith('LULUS')).length}/${log.length} lulus`);
gw.close();
fakeAI.close();
fakeMid.close();
process.exit(0);
