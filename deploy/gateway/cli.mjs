#!/usr/bin/env node
// Pengelolaan kode lisensi MiB di server.
//   node cli.mjs create --tokens 2000000 [--days 30] [--note "Budi, kantor A"]
//   node cli.mjs list
//   node cli.mjs revoke <id|kode>     node cli.mjs restore <id|kode>
import { LicenseStore } from './store.mjs';

const store = new LicenseStore(process.env.DATA_DIR || '/var/lib/mib-gateway');
const [cmd, ...rest] = process.argv.slice(2);
const opt = (name) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};
const fmt = (n) => n.toLocaleString('id-ID');

if (cmd === 'create') {
  const tokens = Number(opt('tokens'));
  if (!Number.isFinite(tokens) || tokens <= 0) {
    console.error('Wajib: --tokens <jumlah token, mis. 2000000>');
    process.exit(1);
  }
  const days = opt('days') ? Number(opt('days')) : undefined;
  const code = store.create({ quotaTokens: tokens, days, note: opt('note') });
  console.log(`Kode lisensi (simpan, hanya tampil sekali):\n\n  ${code}\n\nKuota ${fmt(tokens)} token${days ? `, berlaku ${days} hari` : ', tanpa batas waktu'}.`);
} else if (cmd === 'list') {
  const rows = store.list();
  if (!rows.length) console.log('Belum ada kode.');
  for (const l of rows) {
    const status = l.revoked ? 'DICABUT' : l.expiresAt && Date.now() > Date.parse(l.expiresAt) ? 'KEDALUWARSA' : l.usedTokens >= l.quotaTokens ? 'HABIS' : 'aktif';
    console.log(`${l.id}  ${status.padEnd(11)} ${fmt(l.usedTokens)} / ${fmt(l.quotaTokens)} token  s.d. ${l.expiresAt?.slice(0, 10) || '-'}  ${l.note}`);
  }
} else if (cmd === 'revoke' || cmd === 'restore') {
  if (!rest[0]) {
    console.error('Sebutkan id (dari `list`) atau kode.');
    process.exit(1);
  }
  console.log(store.setRevoked(rest[0], cmd === 'revoke') ? 'Selesai.' : 'Tidak ditemukan.');
} else {
  console.log('Perintah: create | list | revoke | restore');
}
process.exit(0);
