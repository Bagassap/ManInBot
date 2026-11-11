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
  group: "Memulai" | "Kemampuan" | "Keamanan & tim" | "Bantuan";
  title: string;
  summary: string;
  blocks: Block[];
}

export const GROUPS: DocPage["group"][] = ["Memulai", "Kemampuan", "Keamanan & tim", "Bantuan"];

export const DOCS: DocPage[] = [
  {
    slug: "pengantar",
    group: "Memulai",
    title: "Apa itu MiB",
    summary: "Agen AI khusus pekerjaan kantor yang terpasang di komputer Anda dan bekerja memakai aplikasi serta berkas Anda sendiri.",
    blocks: [
      { t: "p", text: "MiB (Man in Bot) adalah agen AI yang Anda pasang di komputer Windows. Anda memberi tugas lewat chat, lalu MiB mengerjakannya di komputer Anda: membaca dan menulis berkas, membuat dokumen Word dan PowerPoint, mengolah Excel, menjalankan perintah, bahkan membuka aplikasi dan mengetik sendiri di layar." },
      { t: "h2", text: "Bagaimana ia bekerja" },
      { t: "ul", items: [
        "Aplikasi desktop MiB menjalankan layanan kecil di komputer Anda (hanya bisa diakses dari komputer itu).",
        "Otak agen adalah model AI. MiB mengirim percakapan dan hasil alat ke layanan AI lewat server MiB (memakai kode lisensi Anda), lalu menjalankan langkah yang diminta.",
        "Berkas, database, dan pengaturan disimpan di komputer Anda, bukan di server MiB.",
        "Tindakan yang mengubah sesuatu (menulis berkas, menjalankan perintah, mengendalikan layar) selalu meminta persetujuan Anda lebih dulu.",
      ] },
      { t: "note", kind: "info", text: "MiB dirancang khusus untuk pekerjaan kantor. Permintaan di luar itu (game, hiburan, media sosial, belanja pribadi, atau aplikasi yang tidak terkait pekerjaan) akan ditolak dengan sopan." },
      { t: "h2", text: "Cocok untuk apa" },
      { t: "ul", items: [
        "Menyusun surat, laporan, dan presentasi dari instruksi singkat.",
        "Merapikan folder dan berkas dalam jumlah banyak.",
        "Membaca dokumen lalu meringkasnya atau mengubahnya menjadi dokumen lain.",
        "Mengolah data di Excel.",
        "Pekerjaan administrasi berulang di aplikasi kantor, seperti memindahkan data antar dokumen.",
      ] },
      { t: "note", kind: "info", text: "MiB saat ini tersedia untuk Windows 10/11. Versi macOS dan Linux belum dirilis." },
    ],
  },
  {
    slug: "instalasi",
    group: "Memulai",
    title: "Instalasi di Windows",
    summary: "Dua cara memasang MiB: pemasang .exe atau satu baris PowerShell.",
    blocks: [
      { t: "h2", text: "Persyaratan" },
      { t: "ul", items: [
        "Windows 10 atau 11 (64-bit).",
        "Sekitar 500 MB ruang kosong (pemasang ±170 MB).",
        "Koneksi internet saat memakai agen (untuk menghubungi layanan AI).",
        "Kode lisensi MiB untuk mengaktifkan agen setelah terpasang.",
      ] },
      { t: "h2", text: "Cara 1: pemasang .exe" },
      { t: "ol", items: [
        "Buka halaman Unduh dan klik tombol Unduh MiB.",
        "Jalankan berkas MiB Setup yang terunduh.",
        "Bila Windows SmartScreen muncul, pilih Info lainnya lalu Tetap jalankan (pemasang belum ditandatangani).",
        "Pilih folder pemasangan bila perlu, lalu selesaikan wizard.",
        "Buka MiB dari Start Menu atau ikon di desktop.",
      ] },
      { t: "h2", text: "Cara 2: satu baris PowerShell" },
      { t: "p", text: "Buka PowerShell, lalu jalankan perintah berikut. Skrip mengunduh pemasang, memeriksa sidik jari SHA-256-nya, dan membatalkan pemasangan bila tidak cocok." },
      { t: "code", text: "irm https://maninbot.id/download/install.ps1 | iex" },
      { t: "note", kind: "warn", text: "Hanya jalankan perintah semacam ini dari alamat yang Anda percaya, dan pastikan alamatnya memakai https." },
      { t: "h2", text: "Memeriksa unduhan" },
      { t: "p", text: "Halaman Unduh menampilkan SHA-256 pemasang. Bandingkan dengan hasil perintah ini:" },
      { t: "code", text: "Get-FileHash .\\MiB-Setup-0.1.0.exe -Algorithm SHA256" },
      { t: "h2", text: "Mencopot pemasangan" },
      { t: "p", text: "Gunakan Pengaturan Windows, Aplikasi, MiB, Copot. Data Anda (database dan pengaturan) sengaja tidak ikut terhapus; hapus foldernya sendiri bila ingin bersih total (lihat Pemecahan masalah)." },
    ],
  },
  {
    slug: "pengaturan-awal",
    group: "Memulai",
    title: "Pengaturan awal",
    summary: "Langkah setelah MiB terpasang: akun pertama, kode lisensi, dan folder yang boleh diakses.",
    blocks: [
      { t: "ol", items: [
        "Buka MiB. Pada pembukaan pertama, buat akun. Akun pertama otomatis menjadi admin di komputer ini.",
        "Buka Pengaturan, lalu masukkan kode lisensi MiB Anda dan simpan. MiB memeriksa kode itu ke server MiB sebelum menyimpan.",
        "Buka Pengaturan, Folder lokal, lalu tambahkan folder yang boleh diakses MiB dan pilih modenya.",
        "Kembali ke chat dan beri tugas pertama, misalnya: tolong lihat isi folder Dokumen.",
      ] },
      { t: "note", kind: "info", text: "Kode lisensi berbentuk MIB-XXXXXX-XXXXXX-XXXXXX dan memiliki kuota pemakaian serta masa berlaku. Layanan AI sudah termasuk, jadi Anda tidak perlu membuat akun atau kunci lain. Sisa kuota terlihat di Pengaturan." },
      { t: "h2", text: "Di mana kode disimpan" },
      { t: "p", text: "Kode disimpan di folder data MiB di komputer Anda, bukan di database. Kode dikirim ke server MiB hanya untuk memeriksa dan menghitung kuota. Tampilan di Pengaturan hanya menunjukkan 4 karakter terakhir." },
    ],
  },
  {
    slug: "folder-izin",
    group: "Kemampuan",
    title: "Folder dan izin",
    summary: "MiB hanya menyentuh folder yang Anda izinkan, dengan mode baca saja atau baca dan tulis.",
    blocks: [
      { t: "p", text: "Agen tidak bisa membaca atau mengubah berkas di luar folder yang Anda daftarkan. Batas ini berlaku untuk semua alat berkas, dokumen, dan perintah." },
      { t: "table", head: ["Mode", "Boleh", "Persetujuan"], rows: [
        ["Hanya baca", "Melihat isi folder, membaca berkas dan dokumen", "Tidak diminta"],
        ["Baca dan tulis", "Semua yang di atas, ditambah menulis berkas, membuat dokumen, dan menjalankan perintah di folder itu", "Diminta setiap kali"],
      ] },
      { t: "h2", text: "Pengaman jalur" },
      { t: "ul", items: [
        "Jalur dengan ../ atau yang mengarah keluar folder izin ditolak.",
        "Pintasan (symlink dan junction) yang menuju ke luar folder izin ditolak.",
        "Berkas biner tidak dibaca sebagai teks.",
      ] },
      { t: "h2", text: "Menambah dan mencabut folder" },
      { t: "p", text: "Buka Pengaturan, Folder lokal. Pilih folder lewat dialog Windows, tentukan modenya, lalu simpan. Cabut kapan saja dengan menghapusnya dari daftar. Perubahan tercatat di log audit." },
    ],
  },
  {
    slug: "dokumen",
    group: "Kemampuan",
    title: "Dokumen: Word, PowerPoint, Excel",
    summary: "Membaca, membuat, dan mengubah dokumen Office, membaca PDF, mengolah Excel, dan membukanya di aplikasi Anda.",
    blocks: [
      { t: "table", head: ["Format", "Baca", "Buat", "Status"], rows: [
        ["Word (.docx)", "Ya, per paragraf", "Ya: judul, paragraf, butir, tabel. Mengubah teks dokumen yang ada: cari dan ganti", "Aktif"],
        ["PowerPoint (.pptx)", "Ya, per slide beserta catatan pembicara", "Ya: slide berisi judul, butir, catatan. Mengubah teks slide yang ada: cari dan ganti", "Aktif"],
        ["Excel (.xlsx)", "Ya", "Ya, lewat lembar kerja per percakapan (buka, ubah, simpan ke .xlsx)", "Aktif"],
        ["PDF (.pdf)", "Ya, per halaman, bila PDF punya lapisan teks", "Belum", "Baca saja. PDF hasil pindai (tanpa teks) belum bisa dibaca (OCR segera)"],
        ["Menambah paragraf, slide, atau gambar ke dokumen yang ada", "-", "-", "Segera"],
      ] },
      { t: "h2", text: "Membuat dokumen" },
      { t: "p", text: "Contoh: buatkan proposal.docx berisi ringkasan, tiga butir keunggulan, dan tabel harga di folder Dokumen. MiB menyusun dokumennya, menampilkan garis besarnya di kartu izin, lalu menyimpannya setelah Anda setuju. Menimpa berkas yang sudah ada selalu membutuhkan persetujuan yang jelas." },
      { t: "h2", text: "Mengubah dokumen yang sudah ada" },
      { t: "p", text: "MiB bisa mengganti teks di dokumen Word atau PowerPoint yang sudah ada tanpa merusak format (huruf, tabel, dan gambar tidak tersentuh), misalnya mengganti nama klien atau periode laporan di seluruh dokumen. Cara terbaik: MiB membaca dokumennya dulu, lalu mengajukan daftar penggantian. Kartu izin menampilkan tiap penggantian beserta jumlahnya. Hasilnya disarankan disimpan sebagai salinan baru supaya berkas asli aman." },
      { t: "note", kind: "info", text: "Pencocokan teks bersifat persis dan peka huruf besar-kecil, dan hanya untuk teks yang berada dalam satu paragraf, sel tabel, atau bentuk. Menambah bagian, slide, atau gambar baru ke dokumen yang sudah ada belum tersedia." },
      { t: "h2", text: "Membuka di aplikasi Anda" },
      { t: "p", text: "MiB bisa membuka berkas di aplikasi bawaan Anda (Word, PowerPoint, Excel, pembaca PDF) agar Anda bisa melihat atau menyuntingnya. Hanya berkas dokumen yang bisa dibuka lewat cara ini; file program seperti .exe, .bat, dan .ps1 ditolak." },
      { t: "note", kind: "info", text: "Bila Anda ingin melihat MiB mengetik sendiri di Word, gunakan Kendali layar. Bila hanya butuh berkasnya jadi, membuat dokumen langsung lebih cepat." },
    ],
  },
  {
    slug: "kendali-layar",
    group: "Kemampuan",
    title: "Kendali layar",
    summary: "MiB melihat layar, menggerakkan mouse, dan mengetik sendiri di aplikasi Anda, dengan izin dan bisa dihentikan kapan saja.",
    blocks: [
      { t: "p", text: "Dengan kendali layar, MiB bekerja seperti orang di depan komputer Anda: membuka Word, memilih dokumen kosong, mengetik teks karakter demi karakter, lalu menyimpannya. Anda menontonnya langsung di layar." },
      { t: "h2", text: "Cara kerjanya" },
      { t: "ol", items: [
        "Anda meminta tugas yang melibatkan aplikasi, misalnya: buka Word dan ketik surat penawaran.",
        "MiB meminta izin untuk mengendalikan mouse dan keyboard, dengan menjelaskan tugasnya. Izin berlaku untuk satu sesi (satu putaran kerja agen).",
        "MiB mengambil tangkapan layar, memutuskan aksi berikutnya (klik, ketik, tekan tombol), lalu memeriksa hasilnya di tangkapan layar berikutnya.",
        "Sesi berakhir saat tugas selesai, saat Anda menghentikannya, atau setelah 300 aksi.",
      ] },
      { t: "h2", text: "Menghentikan" },
      { t: "ul", items: [
        "Tekan tombol Esc.",
        "Gerakkan mouse sendiri (MiB langsung mengalah).",
        "Tekan tombol berhenti di kolom chat.",
      ] },
      { t: "h2", text: "Aplikasi yang bisa diluncurkan langsung" },
      { t: "p", text: "Hanya Microsoft Office: Word, Excel, PowerPoint, Outlook, OneNote, dan Publisher. Aplikasi lain, termasuk Notepad, Kalkulator, dan peramban, tidak bisa dioperasikan. Ini ditegakkan oleh pemeriksa di pengendali, bukan hanya instruksi ke agen: sebelum setiap klik atau ketikan, MiB memeriksa jendela sasarannya. Bila bukan aplikasi kantor (peramban, terminal, Pengaturan, bilah tugas), aksi itu tidak dikirim dan dicatat di log audit sebagai diblokir. Tombol Windows juga tidak diizinkan." },
      { t: "h2", text: "Yang perlu Anda ketahui" },
      { t: "ul", items: [
        "Tangkapan layar dikirim ke layanan AI agar agen bisa melihat. Tutup jendela yang menampilkan data rahasia sebelum memulai.",
        "MiB tidak akan mengetik kata sandi, nomor kartu, atau kode OTP, dan berhenti bila layar menampilkan login atau pembayaran.",
        "Teks yang muncul di layar (pop-up, dokumen, halaman web) diperlakukan sebagai data, bukan perintah.",
        "Hanya monitor utama yang dikendalikan.",
        "Fitur ini hanya tersedia di aplikasi MiB yang berjalan di komputer Windows Anda.",
      ] },
    ],
  },
  {
    slug: "perintah-shell",
    group: "Kemampuan",
    title: "Perintah shell",
    summary: "Menjalankan perintah PowerShell untuk tugas teknis, selalu dengan persetujuan Anda.",
    blocks: [
      { t: "p", text: "MiB dapat menjalankan satu perintah PowerShell di dalam folder yang Anda izinkan dengan mode baca dan tulis. Sebelum dijalankan, kartu izin menampilkan perintah persisnya." },
      { t: "ul", items: [
        "Berjalan tanpa input interaktif, dengan batas waktu (default 60 detik, maksimal 300 detik).",
        "Keluaran dipotong 20 KB.",
        "Kode lisensi dan rahasia MiB tidak diwariskan ke perintah.",
        "Setiap perintah dan kode keluarnya dicatat di log audit.",
      ] },
      { t: "note", kind: "warn", text: "Perintah shell tidak berjalan di dalam sandbox. Setelah Anda menyetujui, perintah itu bisa mengubah atau menghapus isi folder yang diberi izin tulis. Baca perintahnya sebelum menekan Izinkan, dan ragukan perintah yang menghapus, memformat, atau mengubah pengaturan sistem." },
    ],
  },
  {
    slug: "keamanan",
    group: "Keamanan & tim",
    title: "Keamanan dan privasi",
    summary: "Apa yang tetap di komputer Anda, apa yang dikirim ke layanan AI, dan bagaimana tindakan dijaga.",
    blocks: [
      { t: "h2", text: "Tetap di komputer Anda" },
      { t: "ul", items: [
        "Database percakapan, akun, dan log audit.",
        "Kode lisensi Anda.",
        "Seluruh berkas Anda. Tidak ada yang disimpan di server MiB; hanya potongan yang diminta dibaca agen yang ikut dikirim untuk diproses (lihat di bawah).",
      ] },
      { t: "h2", text: "Dikirim lewat server MiB ke layanan AI" },
      { t: "ul", items: [
        "Pesan Anda dan balasan percakapan.",
        "Hasil alat yang dibaca agen, misalnya isi berkas atau dokumen yang diminta untuk dibaca.",
        "Tangkapan layar, hanya selama sesi kendali layar.",
      ] },
      { t: "p", text: "Server MiB hanya meneruskan permintaan itu dan menghitung jumlah token untuk kuota kode lisensi Anda. Isi percakapan, berkas, dan tangkapan layar tidak disimpan di server MiB. Pemrosesan di sisi layanan AI tunduk pada kebijakan penyedianya untuk pemakaian API." },
      { t: "h2", text: "Lapisan pengaman" },
      { t: "ol", items: [
        "Layanan lokal hanya mendengarkan di 127.0.0.1, tidak bisa dijangkau dari jaringan.",
        "Agen hanya bisa menyentuh folder yang Anda daftarkan.",
        "Tindakan yang mengubah sesuatu meminta persetujuan dan kedaluwarsa (ditolak) bila tidak dijawab dalam 5 menit.",
        "Kendali layar bisa dihentikan seketika dengan Esc atau menggerakkan mouse.",
        "Setiap tindakan penting tercatat di log audit.",
        "Isi berkas dan layar diperlakukan sebagai data, bukan perintah, untuk mengurangi risiko prompt injection.",
      ] },
      { t: "note", kind: "warn", text: "Tidak ada sistem yang kebal terhadap instruksi tersembunyi di dokumen atau halaman web. Karena itu persetujuan manusia tetap menjadi pengaman utama. Baca kartu izin sebelum menyetujui." },
    ],
  },
  {
    slug: "tim-audit",
    group: "Keamanan & tim",
    title: "Workspace, anggota, dan log audit",
    summary: "Mengelola anggota di satu workspace dan melihat jejak tindakan agen.",
    blocks: [
      { t: "p", text: "Setiap pengguna punya workspace. Pemilik dan admin dapat mengundang anggota lain dengan peran masing-masing." },
      { t: "table", head: ["Peran", "Bisa"], rows: [
        ["Pemilik (Owner)", "Semuanya, termasuk mengelola workspace"],
        ["Admin", "Mengelola anggota dan folder lokal"],
        ["Anggota (Member)", "Memakai agen"],
      ] },
      { t: "h2", text: "Log audit" },
      { t: "p", text: "Buka Pengaturan workspace, tab Log audit. Di sana tercatat siapa menjalankan agen, folder yang ditambah atau dicabut, berkas yang ditulis, dokumen yang dibuat, perintah yang dijalankan, dan setiap sesi serta aksi kendali layar, lengkap dengan waktu. Log bisa disaring menurut jenis tindakan." },
    ],
  },
  {
    slug: "pemecahan-masalah",
    group: "Bantuan",
    title: "Pemecahan masalah",
    summary: "Masalah yang paling sering muncul dan cara mengatasinya.",
    blocks: [
      { t: "h2", text: "SmartScreen memblokir pemasang" },
      { t: "p", text: "Pemasang belum ditandatangani sehingga Windows memperingatkan. Pilih Info lainnya, lalu Tetap jalankan. Cocokkan SHA-256 di halaman Unduh bila ingin yakin berkasnya asli." },
      { t: "h2", text: "MiB tidak mau terbuka atau langsung menutup" },
      { t: "ul", items: [
        "Pastikan tidak ada MiB lain yang berjalan (cek Task Manager).",
        "Buka berkas log layanan di folder data, subfolder data, lalu logs, lalu backend.log.",
        "Folder data ada di %APPDATA%\\mib-desktop\\data.",
      ] },
      { t: "h2", text: "Agen menjawab bahwa kode lisensi belum dimasukkan" },
      { t: "p", text: "Buka Pengaturan dan masukkan kode lisensi. Jika muncul pesan kuota habis, kedaluwarsa, atau dicabut, hubungi pemberi kode Anda untuk menambah kuota atau memperbarui kode." },
      { t: "h2", text: "Agen tidak bisa melihat atau menulis di folder tertentu" },
      { t: "p", text: "Periksa Pengaturan, Folder lokal: folder harus terdaftar, dan untuk menulis atau menjalankan perintah modenya harus Baca dan tulis. Pintasan yang menuju keluar folder izin sengaja ditolak." },
      { t: "h2", text: "Kendali layar berhenti sendiri" },
      { t: "p", text: "Itu pengaman. Agen berhenti bila Anda menekan Esc atau menggerakkan mouse, bila jumlah aksi melebihi 300, atau bila layar menampilkan sesuatu yang tidak terduga. Mulai lagi dengan meminta tugas yang sama." },
      { t: "h2", text: "Mulai dari awal dan hapus semua data" },
      { t: "p", text: "Tutup MiB, lalu hapus folder %APPDATA%\\mib-desktop. Semua akun, percakapan, dan pengaturan (termasuk kode lisensi) ikut terhapus. Berkas Anda di folder lain tidak tersentuh." },
    ],
  },
];

export const docBySlug = (slug: string) => DOCS.find((d) => d.slug === slug);

export function neighbours(slug: string) {
  const i = DOCS.findIndex((d) => d.slug === slug);
  return { prev: i > 0 ? DOCS[i - 1] : null, next: i >= 0 && i < DOCS.length - 1 ? DOCS[i + 1] : null };
}
