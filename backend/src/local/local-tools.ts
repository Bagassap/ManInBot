import type Anthropic from '@anthropic-ai/sdk';
import { computerEnabled } from './computer.js';

const pathProp = {
  type: 'string',
  description: 'Jalur berkas/folder. Boleh absolut, atau relatif terhadap folder izin pertama.',
} as const;

/** Alat yang menyentuh komputer pengguna. Semuanya dibatasi ke folder yang diizinkan. */
export const fsToolDefinitions: Anthropic.Tool[] = [
  {
    name: 'list_allowed_folders',
    description: 'Menampilkan folder di komputer pengguna yang boleh kamu akses beserta modenya (READ = hanya baca, READWRITE = boleh ubah).',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'fs_list',
    description: 'Melihat isi sebuah folder (nama, jenis, ukuran, tanggal ubah). Tidak perlu izin tambahan.',
    input_schema: { type: 'object', properties: { path: pathProp }, required: ['path'] },
  },
  {
    name: 'fs_read',
    description: 'Membaca isi berkas teks (maks. 200 KB per panggilan; pakai offset untuk bagian berikutnya). Berkas biner ditolak. Tidak perlu izin tambahan.',
    input_schema: {
      type: 'object',
      properties: {
        path: pathProp,
        offset: { type: 'integer', description: 'Mulai membaca dari byte ke-N. Default 0.' },
        max_bytes: { type: 'integer', description: 'Jumlah byte maksimal (default dan batas 200000).' },
      },
      required: ['path'],
    },
  },
  {
    name: 'fs_write',
    description:
      'Menulis berkas teks. PENGGUNA AKAN DIMINTA IZIN setiap kali. Membuat folder induk bila perlu. Untuk menimpa berkas yang sudah ada wajib overwrite=true; baca isinya dulu agar tidak menghapus data penting.',
    input_schema: {
      type: 'object',
      properties: {
        path: pathProp,
        content: { type: 'string', description: 'Isi berkas (maks. 1 MB).' },
        overwrite: { type: 'boolean', description: 'true bila berkas sudah ada dan boleh ditimpa.' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'shell_run',
    description:
      'Menjalankan satu perintah shell (PowerShell di Windows, sh di sistem lain) di dalam folder izin. PENGGUNA AKAN DIMINTA IZIN untuk setiap perintah dan melihat perintah persisnya, jadi tulis perintah yang jelas dan sesempit mungkin. Berjalan tanpa input interaktif; keluaran dipotong 20 KB; batas waktu default 60 detik.',
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Perintah yang dijalankan.' },
        cwd: { type: 'string', description: 'Folder kerja (harus di dalam folder izin). Default: folder izin pertama.' },
        timeout_seconds: { type: 'integer', description: 'Batas waktu 1–300 detik. Default 60.' },
      },
      required: ['command'],
    },
  },
];

/** Alat dokumen Office (Word/PowerPoint) dan membuka berkas di aplikasi milik pengguna. */
export const docToolDefinitions: Anthropic.Tool[] = [
  {
    name: 'doc_read',
    description: 'Membaca teks dari berkas Word (.docx), PowerPoint (.pptx), atau PDF (.pdf, hanya yang punya lapisan teks) di folder izin (per paragraf / per slide beserta catatan pembicara / per halaman). Tidak perlu izin tambahan.',
    input_schema: { type: 'object', properties: { path: pathProp }, required: ['path'] },
  },
  {
    name: 'doc_create',
    description:
      'Membuat berkas Word (.docx) atau PowerPoint (.pptx) baru di folder izin (mode READWRITE). Jenis ditentukan dari ekstensi path. PENGGUNA AKAN DIMINTA IZIN dan melihat garis besar isinya. Untuk .docx isi "blocks"; untuk .pptx isi "slides". Untuk menimpa berkas yang ada wajib overwrite=true.',
    input_schema: {
      type: 'object',
      properties: {
        path: pathProp,
        overwrite: { type: 'boolean' },
        blocks: {
          type: 'array',
          description: 'Khusus .docx. Urutan blok isi dokumen.',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['heading', 'paragraph', 'bullets', 'table'] },
              text: { type: 'string', description: 'Untuk heading / paragraph.' },
              level: { type: 'integer', description: 'Tingkat heading 1–3.' },
              items: { type: 'array', items: { type: 'string' }, description: 'Untuk bullets.' },
              rows: { type: 'array', items: { type: 'array', items: { type: 'string' } }, description: 'Untuk table; baris pertama dipakai sebagai header.' },
            },
            required: ['type'],
          },
        },
        slides: {
          type: 'array',
          description: 'Khusus .pptx. Daftar slide.',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              bullets: { type: 'array', items: { type: 'string' } },
              notes: { type: 'string', description: 'Catatan pembicara.' },
            },
            required: ['title'],
          },
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'doc_edit',
    description:
      'Mengubah isi Word (.docx) atau PowerPoint (.pptx) yang SUDAH ADA dengan cari-dan-ganti teks, tanpa merusak format (huruf, tabel, gambar tidak tersentuh). Pencocokan persis dan peka huruf besar-kecil, hanya untuk teks dalam satu paragraf/sel/bentuk. Baca dokumennya dulu dengan doc_read agar teks find persis sama. PENGGUNA AKAN DIMINTA IZIN dan melihat daftar penggantian. Tulis ke berkas lain lewat save_as (disarankan, aslinya aman), atau isi overwrite=true untuk menimpa berkas asli. Belum bisa menambah paragraf, slide, atau gambar baru.',
    input_schema: {
      type: 'object',
      properties: {
        path: pathProp,
        replacements: {
          type: 'array',
          description: 'Daftar penggantian, diterapkan ke seluruh dokumen (semua kemunculan).',
          items: {
            type: 'object',
            properties: { find: { type: 'string' }, replace: { type: 'string', description: 'Teks pengganti; kosong berarti menghapus.' } },
            required: ['find', 'replace'],
          },
        },
        save_as: { type: 'string', description: 'Jalur berkas hasil (harus ekstensi sama). Bila diisi, berkas asli tidak diubah.' },
        overwrite: { type: 'boolean', description: 'Wajib true bila save_as tidak diisi (menimpa berkas asli) atau save_as sudah ada.' },
      },
      required: ['path', 'replacements'],
    },
  },
  {
    name: 'app_open',
    description:
      'Membuka sebuah berkas di aplikasi bawaan milik pengguna (mis. .docx di Word, .pptx di PowerPoint, .xlsx di Excel, .pdf di pembaca PDF) agar pengguna bisa melihat/menyuntingnya. Hanya berkas dokumen yang diizinkan (bukan program). PENGGUNA AKAN DIMINTA IZIN.',
    input_schema: { type: 'object', properties: { path: pathProp }, required: ['path'] },
  },
];

/** Kendali komputer lewat UI Automation (tanpa tangkapan layar). Hanya di aplikasi lokal Windows. */
export const computerToolDefinitions: Anthropic.Tool[] = [
  {
    name: 'computer_start',
    description: 'Memulai sesi mengoperasikan Microsoft Office di layar pengguna. PENGGUNA AKAN DIMINTA IZIN. Kembalian: daftar elemen layar bernomor.',
    input_schema: {
      type: 'object',
      properties: { task: { type: 'string', description: 'Apa yang akan dikerjakan, singkat.' } },
      required: ['task'],
    },
  },
  {
    name: 'computer',
    description:
      'Mengoperasikan Word/Excel/PowerPoint/Outlook (butuh computer_start). Setiap aksi mengembalikan daftar elemen bernomor seperti: [2] Tombol "Simpan". Nomor berubah setelah setiap aksi, jadi selalu pakai daftar terbaru. Aksi: read; launch (app: word|excel|powerpoint|outlook); click (id); focus (id); set_text (id, text); type (text, di tempat kursor); key (keys, mis. "ctrl+s", "enter"); wait (seconds).',
    input_schema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['read', 'launch', 'click', 'focus', 'set_text', 'type', 'key', 'wait'] },
        id: { type: 'integer', description: 'Nomor elemen dari daftar terakhir.' },
        text: { type: 'string' },
        keys: { type: 'string' },
        app: { type: 'string' },
        seconds: { type: 'integer' },
      },
      required: ['action'],
    },
  },
  {
    name: 'computer_stop',
    description: 'Mengakhiri sesi bila tugas di layar sudah selesai.',
    input_schema: { type: 'object', properties: {} },
  },
];

/** Alat Excel lokal: membuka/menyimpan .xlsx lewat lembar kerja milik percakapan (tersedia di chat). */
export const excelLocalToolDefinitions: Anthropic.Tool[] = [
  {
    name: 'excel_open_local',
    description:
      'Membuka berkas .xlsx dari folder izin ke lembar kerja di layar bersama (menggantikan isi lembar kerja saat ini). Setelah itu kerjakan dengan alat sheet_*. Tidak perlu izin tambahan.',
    input_schema: { type: 'object', properties: { path: pathProp }, required: ['path'] },
  },
  {
    name: 'excel_save_local',
    description:
      'Menyimpan lembar kerja di layar bersama sebagai berkas .xlsx ke folder izin (mode READWRITE). PENGGUNA AKAN DIMINTA IZIN. Untuk menimpa berkas yang ada wajib overwrite=true.',
    input_schema: {
      type: 'object',
      properties: { path: pathProp, overwrite: { type: 'boolean' } },
      required: ['path'],
    },
  },
];

export const LOCAL_TOOL_NAMES = new Set([...fsToolDefinitions, ...docToolDefinitions, ...computerToolDefinitions, ...excelLocalToolDefinitions].map((t) => t.name));

export const localToolsFor = (): Anthropic.Tool[] => {
  const base = [...fsToolDefinitions, ...docToolDefinitions, ...excelLocalToolDefinitions];
  if (computerEnabled()) base.push(...computerToolDefinitions);
  return base;
};
