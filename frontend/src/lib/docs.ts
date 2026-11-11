/** Isi dokumentasi MiB. Hanya menjelaskan yang benar-benar sudah ada; yang belum ditandai "Segera". */

export type Block =
  | { t: "p"; text: string }
  | { t: "h2"; text: string }
  | { t: "ul"; items: string[] }
  | { t: "ol"; items: string[] }
  | { t: "code"; text: string }
  | { t: "note"; kind: "info" | "warn"; text: string }
  | { t: "table"; head: string[]; rows: string[][] };

export interface DocPage {
  slug: string;
  group: "Memulai";
  icon: "book" | "terminal" | "download" | "checklist" | "settings";
  title: string;
  summary: string;
  blocks: Block[];
}

export const GROUPS: DocPage["group"][] = ["Memulai"];

export const DOCS: DocPage[] = [
  {
    slug: "ikhtisar",
    group: "Memulai",
    icon: "book",
    title: "Ikhtisar",
    summary: "Agen AI untuk pekerjaan kantor di komputer Windows Anda.",
    blocks: [
      { t: "p", text: "MiB adalah agen AI untuk pekerjaan kantor. Anda memberi tugas lewat chat, lalu MiB mengerjakannya di komputer Anda: surat, laporan, presentasi, Excel, merapikan berkas, bahkan mengoperasikan Word dan PowerPoint langsung di layar." },
      { t: "ul", items: [
        "Berjalan di komputer Windows Anda; berkas tetap di sana.",
        "Hanya menyentuh folder yang Anda izinkan.",
        "Setiap tindakan penting menunggu persetujuan Anda.",
      ] },
      { t: "note", kind: "info", text: "Khusus pekerjaan kantor; permintaan di luar itu ditolak. Tersedia untuk Windows 10/11. macOS dan Linux belum." },
    ],
  },
  {
    slug: "mulai-cepat",
    group: "Memulai",
    icon: "terminal",
    title: "Mulai cepat",
    summary: "Dari nol sampai tugas pertama dalam tiga langkah.",
    blocks: [
      { t: "ol", items: [
        "Unduh MiB-Setup.exe dari halaman Unduh, jalankan, lalu klik Next, Install, dan Finish.",
        "Buka MiB, klik Daftar, lalu di Pengaturan masuk ke akun MiB dengan email Anda.",
        "Pilih folder kerja di Pengaturan, Folder lokal, lalu beri tugas di chat.",
      ] },
      { t: "p", text: "Lebih suka terminal? Buka PowerShell dan jalankan:" },
      { t: "code", text: "irm https://maninbot.id/download/install.ps1 | iex" },
      { t: "note", kind: "info", text: "Gratis 3 perintah per hari. Paket berbayar membuka 30 perintah per hari." },
    ],
  },
  {
    slug: "instalasi",
    group: "Memulai",
    icon: "download",
    title: "Instalasi",
    summary: "Pasang MiB di Windows dalam beberapa menit.",
    blocks: [
      { t: "h2", text: "Persyaratan" },
      { t: "ul", items: [
        "Windows 10 atau 11 (64-bit)",
        "Ruang kosong sekitar 500 MB",
        "Koneksi internet",
      ] },
      { t: "h2", text: "Pasang" },
      { t: "ol", items: [
        "Unduh MiB-Setup.exe dari halaman Unduh.",
        "Jalankan berkasnya, lalu klik Next, Install, dan Finish.",
      ] },
      { t: "note", kind: "info", text: "Jika muncul layar biru Windows protected your PC, klik Info lainnya, lalu Tetap jalankan. Itu normal untuk pemasang yang belum ditandatangani." },
      { t: "h2", text: "Atau lewat PowerShell" },
      { t: "code", text: "irm https://maninbot.id/download/install.ps1 | iex" },
      { t: "h2", text: "Memperbarui dan mencopot" },
      { t: "p", text: "Untuk memperbarui, unduh dan pasang ulang; data Anda tetap aman. Untuk mencopot, buka Pengaturan Windows, Aplikasi, lalu MiB." },
    ],
  },
  {
    slug: "orientasi",
    group: "Memulai",
    icon: "checklist",
    title: "Orientasi",
    summary: "Tiga langkah sebelum tugas pertama.",
    blocks: [
      { t: "ol", items: [
        "Buka MiB dan klik Daftar untuk membuat akun di komputer ini (hanya untuk masuk ke aplikasi).",
        "Buka Pengaturan, panel Akun MiB: daftar dengan email, lalu tempel kode 6 angka yang dikirim ke email Anda.",
        "Buka Pengaturan, Folder lokal, lalu pilih folder kerja Anda dan modenya.",
      ] },
      { t: "p", text: "Selesai. Kembali ke chat dan beri tugas, misalnya: tolong lihat isi folder Dokumen." },
      { t: "note", kind: "info", text: "Kode tidak sampai? Periksa folder Spam, lalu masuk lagi di panel Akun MiB untuk meminta kode baru." },
    ],
  },
  {
    slug: "konfigurasi",
    group: "Memulai",
    icon: "settings",
    title: "Konfigurasi",
    summary: "Folder, akun dan paket, kendali layar, dan data.",
    blocks: [
      { t: "h2", text: "Folder dan izin" },
      { t: "ul", items: [
        "Agen hanya bisa membaca atau mengubah berkas di folder yang Anda daftarkan di Pengaturan, Folder lokal.",
        "Hanya baca: MiB boleh melihat dan membaca.",
        "Baca dan tulis: MiB juga boleh membuat dan mengubah berkas, dengan persetujuan Anda setiap kali.",
        "Cabut izin kapan saja dengan menghapus folder dari daftar.",
      ] },
      { t: "h2", text: "Akun dan paket" },
      { t: "ul", items: [
        "Gratis: 3 perintah per hari. Berbayar: 30 perintah per hari selama 30 hari.",
        "Satu perintah adalah satu pesan yang Anda kirim ke agen. Kuota diperbarui setiap hari pukul 00.00 WIB.",
        "Bayar dari panel Akun MiB; status berubah sendiri dalam beberapa menit. Kuota habis? Tunggu pergantian hari atau aktifkan paket berbayar.",
      ] },
      { t: "h2", text: "Kendali layar" },
      { t: "ul", items: [
        "MiB bisa mengetik dan mengklik sendiri di Word, Excel, PowerPoint, Outlook, OneNote, dan Publisher. Aplikasi lain tidak bisa dioperasikan.",
        "Selalu meminta izin dulu. Hentikan seketika dengan Esc atau menggerakkan mouse.",
      ] },
      { t: "h2", text: "Data dan privasi" },
      { t: "ul", items: [
        "Tetap di komputer Anda: berkas, riwayat percakapan, dan pengaturan.",
        "Dikirim ke server MiB untuk diproses AI: pesan Anda, isi berkas yang diminta dibaca, dan tangkapan layar saat kendali layar. Isinya tidak disimpan di server.",
        "Server MiB menyimpan email akun, kata sandi terenkripsi, jumlah pemakaian, dan riwayat pembayaran.",
      ] },
      { t: "h2", text: "Mulai dari awal" },
      { t: "p", text: "Tutup MiB lalu hapus folder %APPDATA%\\mib-desktop. Semua akun dan percakapan di komputer ini ikut terhapus; berkas Anda di folder lain tidak tersentuh. Catatan galat ada di %APPDATA%\\mib-desktop\\data\\logs\\backend.log." },
    ],
  },
];

export const docBySlug = (slug: string) => DOCS.find((d) => d.slug === slug);

export function neighbours(slug: string) {
  const i = DOCS.findIndex((d) => d.slug === slug);
  return { prev: i > 0 ? DOCS[i - 1] : null, next: i >= 0 && i < DOCS.length - 1 ? DOCS[i + 1] : null };
}
