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

function htmlBody(intro, code) {
  return `<!doctype html><html><body style="margin:0;background:#f4f6f7;font-family:Segoe UI,Arial,sans-serif;color:#1d2427">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#ffffff;border-radius:14px;border:1px solid #e3e8ea">
<tr><td style="padding:28px 28px 8px;font-size:18px;font-weight:600">MiB</td></tr>
<tr><td style="padding:0 28px;font-size:14px;line-height:1.6;color:#4a575c">${intro}:</td></tr>
<tr><td align="center" style="padding:20px 28px"><div style="display:inline-block;padding:14px 22px;border-radius:12px;background:#eefaf8;border:1px solid #bfe9e2;font-size:32px;letter-spacing:8px;font-weight:700;font-family:Consolas,monospace;color:#0f6f63">${code}</div></td></tr>
<tr><td style="padding:0 28px 28px;font-size:13px;line-height:1.6;color:#6b787d">Kode berlaku 15 menit. Jangan berikan kode ini kepada siapa pun. Jika Anda tidak merasa meminta ini, abaikan email ini.</td></tr>
</table><p style="font-size:12px;color:#8a979c;margin:16px 0 0">MiB (Man in Bot) · maninbot.id</p></td></tr></table></body></html>`;
}

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
    html: htmlBody(INTRO[purpose], code),
  });
}
