import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';
import { LocalToolError } from './paths.js';

export const DOC_MAX_INPUT = 20 * 1024 * 1024;
const XML_MAX = 25 * 1024 * 1024; // batas hasil dekompresi per bagian (anti zip-bomb)
export const DOC_TEXT_MAX = 200_000;

export type Block =
  | { type: 'heading'; text: string; level?: number }
  | { type: 'paragraph'; text: string }
  | { type: 'bullets'; items: string[] }
  | { type: 'table'; rows: string[][] };

export interface Slide {
  title: string;
  bullets?: string[];
  notes?: string;
}

const decode = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, '&');

/** Mengambil teks dari satu bagian XML OOXML: tiap paragraf (w:p / a:p) jadi satu baris. */
function paragraphs(xml: string, p: 'w' | 'a'): string[] {
  const out: string[] = [];
  for (const para of xml.split(`</${p}:p>`)) {
    const t = [...para.matchAll(new RegExp(`<${p}:t(?:\\s[^>]*)?>([^<]*)</${p}:t>|<${p}:tab\\s*/>|<${p}:br\\s*/>`, 'g'))]
      .map((m) => (m[1] !== undefined ? decode(m[1]) : m[0].includes(':tab') ? '\t' : '\n'))
      .join('');
    if (t.trim()) out.push(t);
  }
  return out;
}

async function xmlOf(zip: JSZip, name: string): Promise<string | null> {
  const f = zip.file(name);
  if (!f) return null;
  const size = (f as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize;
  if (typeof size === 'number' && size > XML_MAX) throw new LocalToolError('Isi dokumen terlalu besar setelah dibuka');
  return f.async('string');
}

const num = (n: string) => Number(/(\d+)\.xml$/.exec(n)?.[1] ?? 0);

/** Membaca teks .docx atau .pptx. */
export async function readDocumentText(buf: Buffer, ext: string): Promise<string> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buf);
  } catch {
    throw new LocalToolError('Berkas bukan dokumen Office yang valid (atau rusak)');
  }
  if (ext === '.docx') {
    const xml = await xmlOf(zip, 'word/document.xml');
    if (!xml) throw new LocalToolError('Berkas .docx tidak berisi dokumen');
    return paragraphs(xml, 'w').join('\n');
  }
  if (ext === '.pptx') {
    const slides = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => num(a) - num(b));
    if (!slides.length) throw new LocalToolError('Berkas .pptx tidak berisi slide');
    const parts: string[] = [];
    for (const name of slides) {
      const n = num(name);
      const body = paragraphs((await xmlOf(zip, name)) ?? '', 'a').join('\n');
      const notesXml = await xmlOf(zip, `ppt/notesSlides/notesSlide${n}.xml`);
      const notes = notesXml ? paragraphs(notesXml, 'a').filter((l) => !/^\d+$/.test(l.trim())).join('\n') : '';
      parts.push(`--- Slide ${n} ---\n${body}${notes ? `\n[Catatan pembicara]\n${notes}` : ''}`);
    }
    return parts.join('\n\n');
  }
  throw new LocalToolError('Format tidak didukung (hanya .docx dan .pptx)');
}

const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3];

export async function buildDocx(blocks: Block[]): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];
  for (const b of blocks) {
    if (b.type === 'heading') {
      children.push(new Paragraph({ text: b.text, heading: HEADINGS[Math.min(Math.max((b.level ?? 1) - 1, 0), 2)] }));
    } else if (b.type === 'paragraph') {
      children.push(new Paragraph({ children: [new TextRun(b.text)], spacing: { after: 160 } }));
    } else if (b.type === 'bullets') {
      for (const it of b.items) children.push(new Paragraph({ text: it, bullet: { level: 0 } }));
    } else if (b.type === 'table') {
      const width = Math.max(...b.rows.map((r) => r.length), 1);
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: b.rows.map(
            (r, ri) =>
              new TableRow({
                tableHeader: ri === 0,
                children: Array.from({ length: width }, (_, ci) =>
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r[ci] ?? '', bold: ri === 0 })] })] }),
                ),
              }),
          ),
        }),
        new Paragraph({ text: '' }),
      );
    }
  }
  if (!children.length) throw new LocalToolError('Dokumen kosong');
  return Packer.toBuffer(new Document({ sections: [{ children }] }));
}

export async function buildPptx(slides: Slide[]): Promise<Buffer> {
  if (!slides.length) throw new LocalToolError('Presentasi kosong');
  const Ctor = ((PptxGenJS as unknown as { default?: unknown }).default ?? PptxGenJS) as unknown as new () => InstanceType<typeof import('pptxgenjs').default>;
  const pres = new Ctor();
  pres.layout = 'LAYOUT_WIDE';
  for (const s of slides) {
    const slide = pres.addSlide();
    slide.addText(s.title, { x: 0.6, y: 0.4, w: 12.1, h: 1, fontSize: 32, bold: true, color: '1F2937' });
    if (s.bullets?.length) {
      slide.addText(
        s.bullets.map((t) => ({ text: t, options: { bullet: true, breakLine: true } })),
        { x: 0.8, y: 1.6, w: 11.8, h: 5.2, fontSize: 20, color: '374151', valign: 'top', paraSpaceAfter: 8 },
      );
    }
    if (s.notes) slide.addNotes(s.notes);
  }
  return (await pres.write({ outputType: 'nodebuffer' })) as Buffer;
}

const PDF_MAX_PAGES = 300;

/** Membaca teks PDF (per halaman). PDF hasil pindai (tanpa lapisan teks) menghasilkan pesan khusus. */
export async function readPdfText(buf: Buffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import('unpdf');
  let pages: string[];
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    if (pdf.numPages > PDF_MAX_PAGES) throw new LocalToolError(`PDF terlalu panjang (${pdf.numPages} halaman; maksimal ${PDF_MAX_PAGES})`);
    const r = await extractText(pdf, { mergePages: false });
    pages = r.text;
  } catch (e) {
    if (e instanceof LocalToolError) throw e;
    throw new LocalToolError('PDF tidak bisa dibaca (rusak, terenkripsi, atau bukan PDF)');
  }
  const body = pages.map((t, i) => `--- Halaman ${i + 1} ---\n${t.trim()}`).join('\n\n');
  if (!pages.some((t) => t.trim())) {
    throw new LocalToolError('PDF ini tidak punya lapisan teks (kemungkinan hasil pindai/gambar), jadi tidak bisa dibaca sebagai teks. OCR belum tersedia.');
  }
  return body;
}

export interface Replacement {
  find: string;
  replace: string;
}

const encode = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Mengganti teks dalam satu paragraf XML (w:p / a:p) tanpa merusak format: teks yang terbelah di beberapa "run" tetap terdeteksi. */
function replaceInParagraph(xml: string, ns: 'w' | 'a', pairs: Replacement[], counts: number[]): string {
  const re = new RegExp(`(<${ns}:t(?:\\s[^>]*)?>)([^<]*)(</${ns}:t>)`, 'g');
  const runs = [...xml.matchAll(re)].map((m) => ({ open: m[1], close: m[3], index: m.index ?? 0, length: m[0].length, text: decode(m[2]) }));
  if (!runs.length) return xml;
  const texts = runs.map((r) => r.text);
  let changed = false;
  pairs.forEach((p, pi) => {
    if (!p.find) return;
    let from = 0;
    for (;;) {
      const joined = texts.join('');
      const pos = joined.indexOf(p.find, from);
      if (pos === -1) break;
      const end = pos + p.find.length;
      let acc = 0;
      let si = -1;
      let ei = -1;
      let sAcc = 0;
      let eAcc = 0;
      for (let i = 0; i < texts.length; i++) {
        const next = acc + texts[i].length;
        if (si === -1 && pos < next) {
          si = i;
          sAcc = acc;
        }
        if (end <= next && ei === -1 && end > acc) {
          ei = i;
          eAcc = acc;
          break;
        }
        acc = next;
      }
      if (si === -1 || ei === -1) break;
      if (si === ei) texts[si] = texts[si].slice(0, pos - sAcc) + p.replace + texts[si].slice(end - eAcc);
      else {
        texts[si] = texts[si].slice(0, pos - sAcc) + p.replace;
        for (let i = si + 1; i < ei; i++) texts[i] = '';
        texts[ei] = texts[ei].slice(end - eAcc);
      }
      counts[pi]++;
      changed = true;
      from = pos + p.replace.length;
    }
  });
  if (!changed) return xml;
  let out = xml;
  for (let i = runs.length - 1; i >= 0; i--) {
    const r = runs[i];
    const open = ns === 'w' && !/xml:space=/.test(r.open) ? r.open.replace(`<${ns}:t`, `<${ns}:t xml:space="preserve"`) : r.open;
    out = out.slice(0, r.index) + open + encode(texts[i]) + r.close + out.slice(r.index + r.length);
  }
  return out;
}

/**
 * Cari-dan-ganti teks di .docx / .pptx yang sudah ada, mempertahankan format. Hanya teks yang berada dalam satu paragraf
 * (atau satu bentuk/sel) yang bisa diganti; pencocokan persis dan peka huruf besar-kecil.
 */
export async function editOoxml(buf: Buffer, ext: string, pairs: Replacement[]): Promise<{ buffer: Buffer; counts: number[] }> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buf);
  } catch {
    throw new LocalToolError('Berkas bukan dokumen Office yang valid (atau rusak)');
  }
  const ns = ext === '.docx' ? 'w' : 'a';
  const parts = Object.keys(zip.files).filter((n) =>
    ext === '.docx' ? /^word\/(document|header\d*|footer\d*)\.xml$/.test(n) : /^ppt\/(slides\/slide|notesSlides\/notesSlide)\d+\.xml$/.test(n),
  );
  if (!parts.length) throw new LocalToolError('Isi dokumen tidak ditemukan');
  const counts = pairs.map(() => 0);
  const para = new RegExp(`<${ns}:p[ >][\\s\\S]*?</${ns}:p>`, 'g');
  for (const name of parts) {
    const xml = await xmlOf(zip, name);
    if (xml === null) continue;
    const next = xml.replace(para, (p) => replaceInParagraph(p, ns, pairs, counts));
    if (next !== xml) zip.file(name, next);
  }
  return { buffer: await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }), counts };
}

export function parseReplacements(v: unknown): Replacement[] {
  if (!Array.isArray(v) || v.length === 0 || v.length > 100) throw new LocalToolError('replacements harus berupa daftar 1–100 pasang {find, replace}');
  return v.map((raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    if (typeof o.find !== 'string' || !o.find || o.find.length > 2000) throw new LocalToolError('Setiap penggantian butuh find (teks tidak kosong, maks. 2000 karakter)');
    if (typeof o.replace !== 'string' || o.replace.length > 20_000) throw new LocalToolError('Setiap penggantian butuh replace (teks, boleh kosong; maks. 20000 karakter)');
    return { find: o.find, replace: o.replace };
  });
}

/** Validasi masukan dari model menjadi Block[] / Slide[] (jangan percaya bentuknya). */
export function parseBlocks(v: unknown): Block[] {
  if (!Array.isArray(v) || v.length > 500) throw new LocalToolError('blocks harus berupa daftar (maks. 500)');
  const s = (x: unknown) => (typeof x === 'string' ? x.slice(0, 20_000) : '');
  return v.map((raw): Block => {
    const b = (raw ?? {}) as Record<string, unknown>;
    switch (b.type) {
      case 'heading':
        return { type: 'heading', text: s(b.text), level: typeof b.level === 'number' ? b.level : 1 };
      case 'paragraph':
        return { type: 'paragraph', text: s(b.text) };
      case 'bullets':
        if (!Array.isArray(b.items)) throw new LocalToolError('bullets.items harus berupa daftar');
        return { type: 'bullets', items: b.items.slice(0, 200).map(s) };
      case 'table':
        if (!Array.isArray(b.rows)) throw new LocalToolError('table.rows harus berupa daftar');
        return { type: 'table', rows: b.rows.slice(0, 500).map((r) => (Array.isArray(r) ? r.slice(0, 30).map(s) : [])) };
      default:
        throw new LocalToolError(`Jenis blok tidak dikenal: ${String(b.type)}`);
    }
  });
}

export function parseSlides(v: unknown): Slide[] {
  if (!Array.isArray(v) || v.length > 100) throw new LocalToolError('slides harus berupa daftar (maks. 100)');
  const s = (x: unknown) => (typeof x === 'string' ? x.slice(0, 5000) : '');
  return v.map((raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      title: s(o.title),
      bullets: Array.isArray(o.bullets) ? o.bullets.slice(0, 30).map(s) : undefined,
      notes: o.notes === undefined ? undefined : s(o.notes),
    };
  });
}
