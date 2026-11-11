// Pengiriman email lewat SMTP (nodemailer). Tanpa SMTP_HOST, kode hanya dicatat di log bila DEV_LOG_CODES=1 (untuk uji).
import nodemailer from 'nodemailer';

let transport = null;
function get() {
  if (!process.env.SMTP_HOST) return null;
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === '1',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return transport;
}

export const mailReady = () => !!process.env.SMTP_HOST || process.env.DEV_LOG_CODES === '1';

const SUBJECT = { verify: 'Kode verifikasi MiB', reset: 'Kode atur ulang kata sandi MiB' };
const INTRO = { verify: 'Gunakan kode berikut untuk memverifikasi akun MiB Anda', reset: 'Gunakan kode berikut untuk mengatur ulang kata sandi akun MiB Anda' };

export async function sendCode(email, purpose, code) {
  const t = get();
  if (!t) {
    if (process.env.DEV_LOG_CODES === '1') console.log(`[kode-uji] ${email} ${purpose} ${code}`);
    else throw new Error('SMTP belum diatur');
    return;
  }
  await t.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: email,
    subject: SUBJECT[purpose],
    text: `${INTRO[purpose]}:\n\n  ${code}\n\nKode berlaku 15 menit. Jika Anda tidak merasa meminta ini, abaikan email ini.\n\nMiB (Man in Bot)`,
  });
}
