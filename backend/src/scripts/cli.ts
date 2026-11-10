import 'dotenv/config';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { PrismaClient } from '../generated/prisma/client.js';

/**
 * Perintah pengelolaan (dijalankan lewat `npm run cli -- <perintah>`):
 *   make-admin <email>   jadikan akun yang sudah terdaftar sebagai ADMIN
 *   create-admin <email> [--reset]  buat akun admin dengan kata sandi acak (atau naikkan akun yang ada;
 *                        --reset juga mengganti kata sandinya dan mengakhiri sesi lamanya)
 *   revoke-admin <email> kembalikan ke USER
 *   seed-demo            isi data contoh (akun @demo.mib.test) agar dashboard admin ada isinya
 *   clear-demo           hapus semua data contoh itu
 */
const DEMO_DOMAIN = '@demo.mib.test';

const prisma = new PrismaClient();

// Pseudo-acak berbenih: hasilnya sama setiap kali dijalankan.
let seed = 20261104;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = <T>(a: T[]): T => a[Math.floor(rnd() * a.length)];
const between = (a: number, b: number) => Math.round(a + rnd() * (b - a));

const DEMO_USERS = [
  ['Rina Kusuma', 'rina'],
  ['Budi Santoso', 'budi'],
  ['Maya Lestari', 'maya'],
  ['Andre Wijaya', 'andre'],
  ['Siti Rahma', 'siti'],
  ['Dimas Pratama', 'dimas'],
];

const PROMPTS: [string, string, number][] = [
  ['Hitung PPN 11% dari tagihan Rp 12.500.000', 'PPN 11% = Rp 1.375.000, total tagihan Rp 13.875.000.', 1],
  ['Susun draf jurnal beban sewa dibayar di muka Rp 24.000.000 per tahun', 'Dr. Sewa dibayar di muka 24.000.000 / Cr. Kas 24.000.000. Amortisasi bulanan Rp 2.000.000.', 1],
  ['Hitung THR karyawan masa kerja 8 bulan, gaji Rp 6.000.000', 'THR proporsional = 8/12 x 6.000.000 = Rp 4.000.000.', 1],
  ['Buat checklist audit internal untuk siklus pembelian', '1. Otorisasi PO  2. Pencocokan 3 arah  3. Pemisahan tugas  4. Batas anggaran  5. Ulasan vendor.', 0],
  ['Telaah dampak akuntansi, pajak, hukum, dan SDM bila satu cabang ditutup', 'Dampak: penurunan nilai aset (PSAK 48), pajak final, pesangon, dan pemberitahuan ke instansi.', 3],
  ['Ringkas varians anggaran Q3: realisasi 8,4 M dari anggaran 7,9 M', 'Varians tidak menguntungkan Rp 500 juta (6,3%). Periksa pos perjalanan dinas dan sewa.', 2],
  ['Susun draf klausul kerahasiaan untuk kontrak vendor', 'Klausul 1: definisi informasi rahasia. Klausul 2: kewajiban. Klausul 3: jangka waktu 3 tahun.', 0],
  ['Hitung lembur 12 jam karyawan bergaji Rp 5.500.000', 'Upah per jam 1/173 x 5.500.000 = 31.792. Lembur dihitung bertingkat sesuai aturan.', 2],
  ['Identifikasi risiko utama proses penagihan piutang', 'Risiko: piutang macet, kredit limit longgar, rekonsiliasi terlambat. Mitigasi: aging mingguan.', 0],
  ['Buat proyeksi arus kas 6 bulan dengan pertumbuhan 5% per bulan', 'Kas akhir bulan ke-6 diproyeksikan Rp 1,34 M dengan asumsi biaya tetap.', 4],
  ['Bandingkan metode penyusutan garis lurus dan saldo menurun untuk mesin Rp 80 juta', 'Garis lurus 10 tahun: 8 juta per tahun. Saldo menurun 20%: tahun pertama 16 juta.', 3],
  ['Apa saja dokumen perizinan untuk mendirikan PT?', 'Akta pendirian, SK Kemenkumham, NPWP, NIB lewat OSS, dan izin usaha sesuai KBLI.', 0],
];

const ERRORS = [
  'RateLimitError: 429 Layanan AI sedang sibuk',
  'APIConnectionError: Connection error.',
  'InternalServerError: 500 Terjadi kesalahan internal',
];

async function makeAdmin(email: string | undefined, role: 'ADMIN' | 'USER') {
  if (!email) throw new Error('Sertakan email: npm run cli -- make-admin email@anda.com');
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) throw new Error(`Akun ${email} belum terdaftar. Daftar dulu di halaman /daftar, lalu ulangi.`);
  await prisma.user.update({ where: { id: user.id }, data: { role } });
  console.log(`${user.email} sekarang ${role}.`);
}

/** Kata sandi acak yang kuat, tanpa karakter yang mudah tertukar. */
function strongPassword(n = 18) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(n);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

async function createAdmin(email: string | undefined, reset: boolean) {
  if (!email) throw new Error('Sertakan email: npm run cli -- create-admin email@anda.com');
  const addr = email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: addr } });

  if (existing && !reset) {
    await prisma.user.update({ where: { id: existing.id }, data: { role: 'ADMIN', blockedAt: null } });
    console.log(`Akun ${addr} sudah ada: sekarang ADMIN. Kata sandinya TIDAK diubah (tambahkan --reset untuk membuat yang baru).`);
    return;
  }

  const password = strongPassword();
  const passwordHash = await argon2.hash(password);
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { role: 'ADMIN', blockedAt: null, passwordHash, sessionsValidAfter: new Date(Math.floor(Date.now() / 1000) * 1000) },
    });
  } else {
    await prisma.user.create({ data: { email: addr, name: 'Admin', role: 'ADMIN', passwordHash } });
  }
  console.log(`
Akun admin ${existing ? 'diperbarui' : 'dibuat'}:
  Email     : ${addr}
  Kata sandi: ${password}

Catat sekarang; kata sandi ini tidak disimpan di tempat lain dan tidak akan ditampilkan lagi.`);
}

async function seedDemo() {
  await clearDemo(false);
  const users = [];
  for (const [name, handle] of DEMO_USERS) {
    users.push(
      await prisma.user.create({
        data: {
          email: `${handle}${DEMO_DOMAIN}`,
          name,
          role: 'USER',
          createdAt: new Date(Date.now() - between(2, 60) * 86_400_000),
          memberships: { create: { role: 'OWNER', workspace: { create: { name: `${name} (Demo)`, slug: `demo-${handle}-${Math.random().toString(16).slice(2, 8)}` } } } },
        },
        include: { memberships: { select: { workspaceId: true } } },
      }),
    );
  }

  let runs = 0;
  for (let daysAgo = 59; daysAgo >= 0; daysAgo--) {
    // lebih ramai pada hari kerja, dan tren naik seiring waktu
    const day = new Date(Date.now() - daysAgo * 86_400_000);
    const weekend = [0, 6].includes(day.getDay());
    const load = Math.round((weekend ? 1 : 4) * (1 + (60 - daysAgo) / 40) * (0.6 + rnd() * 0.9));
    for (let i = 0; i < load; i++) {
      const user = pick(users);
      const [prompt, answer, tools] = pick(PROMPTS);
      const at = new Date(day);
      at.setHours(between(8, 18), between(0, 59), between(0, 59), 0);
      if (at.getTime() > Date.now()) continue;

      const roll = rnd();
      const status = roll < 0.07 ? 'ERROR' : roll < 0.1 ? 'ABORTED' : 'SUCCESS';
      const durationMs = between(2_500, 14_000) + tools * between(1_500, 4_500) + (daysAgo < 20 ? -1_500 : 0);
      const conv = await prisma.conversation.create({
        data: { userId: user.id, workspaceId: user.memberships[0].workspaceId, title: prompt.slice(0, 50), createdAt: at, updatedAt: at },
      });
      await prisma.message.create({ data: { conversationId: conv.id, role: 'USER', content: prompt, createdAt: at } });
      if (status === 'SUCCESS') {
        await prisma.message.create({
          data: {
            conversationId: conv.id,
            role: 'ASSISTANT',
            content: answer,
            steps: tools
              ? Array.from({ length: Math.min(tools, 3) }, (_, k) => ({
                  id: `demo-${k}`,
                  name: 'calculate',
                  input: { expression: `${between(10, 900)} * ${between(2, 40)}` },
                  output: String(between(1_000, 90_000)),
                  isError: false,
                }))
              : undefined,
            createdAt: new Date(at.getTime() + durationMs),
          },
        });
      }
      await prisma.agentRun.create({
        data: {
          userId: user.id,
          workspaceId: user.memberships[0].workspaceId,
          conversationId: conv.id,
          model: rnd() < 0.85 ? 'claude-opus-5-5' : 'claude-sonnet-5-5',
          status,
          durationMs: status === 'ERROR' ? between(800, 4_000) : durationMs,
          inputTokens: status === 'ERROR' ? 0 : between(900, 6_500),
          outputTokens: status === 'ERROR' ? 0 : between(300, 4_200),
          toolCalls: status === 'SUCCESS' ? tools : 0,
          error: status === 'ERROR' ? pick(ERRORS) : null,
          prompt,
          createdAt: at,
        },
      });
      runs++;
    }
  }
  console.log(`Data contoh dibuat: ${users.length} akun (@demo.mib.test), ${runs} perintah agen.`);
}

async function clearDemo(log = true) {
  const r = await prisma.user.deleteMany({ where: { email: { endsWith: DEMO_DOMAIN } } });
  await prisma.workspace.deleteMany({ where: { memberships: { none: {} } } });
  if (log) console.log(`Data contoh dihapus: ${r.count} akun beserta percakapan dan catatan agennya.`);
}

const [cmd, arg] = process.argv.slice(2);
try {
  if (cmd === 'make-admin') await makeAdmin(arg, 'ADMIN');
  else if (cmd === 'create-admin') await createAdmin(arg, process.argv.includes('--reset'));
  else if (cmd === 'revoke-admin') await makeAdmin(arg, 'USER');
  else if (cmd === 'seed-demo') await seedDemo();
  else if (cmd === 'clear-demo') await clearDemo();
  else {
    console.log('Perintah: make-admin <email> | create-admin <email> [--reset] | revoke-admin <email> | seed-demo | clear-demo');
    process.exitCode = 1;
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
