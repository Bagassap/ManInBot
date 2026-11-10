import { describe, expect, it } from 'vitest';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { buildDocx, buildPptx, editOoxml, parseBlocks, parseReplacements, parseSlides, readDocumentText, readPdfText } from './documents.js';
import { isOpenable } from './open-app.js';

describe('dokumen Office', () => {
  it('docx: tulis lalu baca kembali (termasuk karakter khusus dan tabel)', async () => {
    const buf = await buildDocx(
      parseBlocks([
        { type: 'heading', text: 'Laporan <Q3> & "ringkasan"', level: 1 },
        { type: 'paragraph', text: 'Pendapatan naik 12% — bagus.' },
        { type: 'bullets', items: ['satu', 'dua'] },
        { type: 'table', rows: [['Bulan', 'Total'], ['Jan', '100']] },
      ]),
    );
    const text = await readDocumentText(buf, '.docx');
    expect(text).toContain('Laporan <Q3> & "ringkasan"');
    expect(text).toContain('Pendapatan naik 12% — bagus.');
    expect(text).toContain('satu');
    expect(text).toContain('Jan');
    expect(text).toContain('100');
  });

  it('pptx: tulis lalu baca kembali per slide dengan catatan', async () => {
    const buf = await buildPptx(
      parseSlides([
        { title: 'Pembuka', bullets: ['poin A', 'poin B'], notes: 'sapa hadirin' },
        { title: 'Penutup' },
      ]),
    );
    const text = await readDocumentText(buf, '.pptx');
    expect(text).toMatch(/Slide 1 ---\s*Pembuka/);
    expect(text).toContain('poin B');
    expect(text).toContain('sapa hadirin');
    expect(text).toContain('Slide 2');
    expect(text).toContain('Penutup');
  });

  it('menolak berkas yang bukan dokumen Office', async () => {
    await expect(readDocumentText(Buffer.from('bukan zip'), '.docx')).rejects.toThrow(/bukan dokumen Office/);
  });

  it('menolak masukan model yang bentuknya salah', () => {
    expect(() => parseBlocks('x')).toThrow();
    expect(() => parseBlocks([{ type: 'script' }])).toThrow(/tidak dikenal/);
    expect(() => parseSlides({})).toThrow();
  });

  it('app_open hanya untuk dokumen, bukan program', () => {
    expect(isOpenable('C:\\x\\a.docx')).toBe(true);
    expect(isOpenable('C:\\x\\a.PDF')).toBe(true);
    for (const f of ['a.exe', 'a.bat', 'a.ps1', 'a.lnk', 'a.js', 'a.cmd', 'a.msi', 'a.docx.exe', 'a']) expect(isOpenable(f)).toBe(false);
  });

  it('docx: cari-ganti mempertahankan format dan menangani teks yang terbelah di beberapa run', async () => {
    const buf = await Packer.toBuffer(
      new Document({
        sections: [{ children: [
          new Paragraph({ children: [new TextRun('Kepada Yth. PT '), new TextRun({ text: 'Maju', bold: true }), new TextRun(' Jaya & Rekan')] }),
          new Paragraph({ children: [new TextRun('PT Maju lagi.')] }),
        ] }],
      }),
    );
    const { buffer, counts } = await editOoxml(buf, '.docx', [{ find: 'PT Maju', replace: 'CV <Sinar> & Co' }, { find: 'tidak ada', replace: 'x' }]);
    expect(counts).toEqual([2, 0]);
    const text = await readDocumentText(buffer, '.docx');
    expect(text).toContain('Kepada Yth. CV <Sinar> & Co Jaya & Rekan');
    expect(text).toContain('CV <Sinar> & Co lagi.');
    expect(text).not.toContain('PT Maju');
  });

  it('pptx: cari-ganti di slide', async () => {
    const buf = await buildPptx(parseSlides([{ title: 'Laporan Q3', bullets: ['Q3 naik', 'Target Q3 tercapai'] }]));
    const { buffer, counts } = await editOoxml(buf, '.pptx', [{ find: 'Q3', replace: 'Q4' }]);
    expect(counts).toEqual([3]);
    const text = await readDocumentText(buffer, '.pptx');
    expect(text).toContain('Laporan Q4');
    expect(text).toContain('Target Q4 tercapai');
  });

  it('edit: berkas yang rusak ditolak dan masukan penggantian divalidasi', async () => {
    await expect(editOoxml(Buffer.from('x'), '.docx', [{ find: 'a', replace: 'b' }])).rejects.toThrow(/bukan dokumen Office/);
    expect(() => parseReplacements([])).toThrow();
    expect(() => parseReplacements([{ find: '', replace: 'x' }])).toThrow();
    expect(parseReplacements([{ find: 'a', replace: '' }])).toEqual([{ find: 'a', replace: '' }]);
  });

  it('pdf: membaca teks per halaman, dan menolak berkas bukan PDF', async () => {
    const pdf = [
      '%PDF-1.4',
      '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
      '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
      '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj',
      '4 0 obj<</Length 44>>stream',
      'BT /F1 24 Tf 20 100 Td (Halo PDF MiB) Tj ET',
      'endstream endobj',
      '5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj',
      'trailer<</Root 1 0 R/Size 6>>',
      '%%EOF',
    ].join('\n');
    const text = await readPdfText(Buffer.from(pdf, 'latin1'));
    expect(text).toContain('Halaman 1');
    expect(text).toContain('Halo PDF MiB');
    await expect(readPdfText(Buffer.from('bukan pdf'))).rejects.toThrow(/tidak bisa dibaca/);
  });
});
