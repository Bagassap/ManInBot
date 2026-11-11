// Titik masuk layanan gateway MiB.
import { createServer } from 'node:http';
import { Db } from './db.mjs';
import { mailReady } from './mail.mjs';
import { CFG, createGateway } from './server.mjs';

if (!CFG.aiKey) {
  console.error('ANTHROPIC_API_KEY belum diatur');
  process.exit(1);
}
const db = new Db(process.env.DATA_DIR || '/var/lib/mib-gateway');
const server = createServer(createGateway(db));
server.requestTimeout = 0; // aliran jawaban bisa lama
server.headersTimeout = 30_000;
const port = Number(process.env.PORT || 4100);
const pay = CFG.midtransKey && CFG.priceIdr > 0;
server.listen(port, '127.0.0.1', () => console.log(`gateway MiB di 127.0.0.1:${port} | email: ${mailReady() ? 'siap' : 'BELUM diatur'} | pembayaran: ${pay ? 'siap' : 'BELUM diatur'}`));
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => process.exit(0));
