#!/usr/bin/env node
import { Db, dayKey, hashPassword } from './db.mjs';

if (process.argv[2] === 'hash-stdin') {
  let pw = '';
  for await (const c of process.stdin) pw += c;
  pw = pw.trimEnd();
  if (pw.length < 12) {
    console.error('Kata sandi admin minimal 12 karakter.');
    process.exit(1);
  }
  console.log(hashPassword(pw));
  process.exit(0);
}

if (process.argv[2] === 'test-mail') {
  const { sendCode } = await import('./mail.mjs');
  try {
    await sendCode(String(process.argv[3] || ''), 'verify', '123456');
    console.log('Email percobaan terkirim.');
    process.exit(0);
  } catch (e) {
    console.error(`Gagal mengirim: ${e?.message || e}`);
    process.exit(1);
  }
}

const db = new Db(process.env.DATA_DIR || '/var/lib/mib-gateway');
const [cmd, arg, ...rest] = process.argv.slice(2);
const opt = (name) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};
const norm = (e) => String(e || '').trim().toLowerCase();

if (cmd === 'users') {
  const rows = db.listUsers();
  if (!rows.length) console.log('Belum ada akun.');
  for (const u of rows) {
    const paid = u.paid_until > Date.now() ? `berbayar s.d. ${new Date(u.paid_until).toISOString().slice(0, 10)}` : 'gratis';
    console.log(`${String(u.id).padStart(4)}  ${u.email.padEnd(34)} ${u.verified ? 'terverifikasi' : 'BELUM verifikasi'}  ${paid}  hari ini ${db.usedToday(u.id)} perintah${u.banned ? '  [DIBLOKIR]' : ''}`);
  }
  console.log(`\nHari ini (WIB): ${dayKey()}`);
} else if (cmd === 'grant') {
  const days = Number(opt('days'));
  const u = db.userByEmail(norm(arg));
  if (!u) {
    console.error('Akun tidak ditemukan.');
    process.exit(1);
  }
  if (!Number.isFinite(days) || days <= 0) {
    console.error('Wajib: --days <jumlah hari>');
    process.exit(1);
  }
  console.log(`Paket berbayar ${u.email} berlaku s.d. ${new Date(db.extendPaid(u.id, days)).toISOString().slice(0, 10)}`);
} else if (cmd === 'ban' || cmd === 'unban') {
  console.log(db.setBanned(norm(arg), cmd === 'ban') ? 'Selesai.' : 'Akun tidak ditemukan.');
} else {
  console.log('Perintah: users | grant <email> --days N | ban <email> | unban <email>');
}
process.exit(0);
