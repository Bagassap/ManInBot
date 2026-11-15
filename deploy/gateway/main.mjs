// Titik masuk layanan gateway MiB.
import { createServer } from 'node:http';
import { Db } from './db.mjs';
import { mailReady } from './mail.mjs';
import { CFG, createGateway } from './server.mjs';

// Tanpa kunci layanan AI gateway tetap berjalan: pendaftaran, pembayaran, dan dashboard admin bisa dipakai;
// permintaan AI dijawab "belum dikonfigurasi".
if (!CFG.aiKey) console.warn('PERINGATAN: ANTHROPIC_API_KEY belum diatur; agen belum bisa bekerja');
const db = new Db(process.env.DATA_DIR || '/var/lib/mib-gateway');
const server = createServer(createGateway(db));
server.requestTimeout = 0; // aliran jawaban bisa lama
server.headersTimeout = 30_000;
const port = Number(process.env.PORT || 4100);
const pay = CFG.midtransKey && CFG.priceIdr > 0;
server.listen(port, '127.0.0.1', () => console.log(`gateway MiB di 127.0.0.1:${port} | email: ${mailReady() ? 'siap' : 'BELUM diatur'} | pembayaran: ${pay ? 'siap' : 'BELUM diatur'} | admin: ${process.env.ADMIN_PATH && process.env.ADMIN_PASS_HASH ? 'aktif' : 'nonaktif'}`));
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => process.exit(0));
