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
        "MiB adalah aplikasi di komputer Anda. Berkas, folder kerja, dan pengaturan tetap tersimpan di sana.",
        "Untuk memahami dan mengerjakan tugas, MiB memakai kecerdasan AI yang sudah termasuk di akun MiB Anda. Isi percakapan dan bagian berkas yang diminta untuk dibaca dikirim ke server MiB agar diproses, dan tidak disimpan di sana.",
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
    summary: "Memasang MiB di Windows langkah demi langkah, dengan dua cara pilihan.",
    blocks: [
      { t: "p", text: "Memasang MiB memakan waktu sekitar 5 menit. Ada dua cara: pemasang .exe (paling mudah, disarankan) atau satu baris perintah di PowerShell." },
      { t: "h2", text: "Sebelum mulai" },
      { t: "ul", items: [
        "Windows 10 atau 11, 64-bit. Untuk memeriksanya: Pengaturan Windows, Sistem, Tentang, lalu lihat Tipe sistem (harus 64-bit).",
        "Ruang kosong sekitar 500 MB (berkas pemasang sendiri ±170 MB).",
        "Koneksi internet, saat memasang dan saat memakai agen.",
        "Email aktif, untuk membuat akun MiB setelah terpasang.",
        "Tidak perlu hak administrator Windows. MiB terpasang untuk pengguna Windows Anda saja.",
      ] },
      { t: "h2", text: "Cara 1: pemasang .exe (disarankan)" },
      { t: "ol", items: [
        "Buka halaman Unduh di situs ini dan klik tombol Unduh MiB. Berkas bernama MiB-Setup.exe akan tersimpan di folder Unduhan (Downloads) Anda.",
        "Setelah unduhan selesai, buka folder Unduhan lalu klik dua kali berkas MiB-Setup.exe.",
        "Jika muncul layar biru bertuliskan Windows protected your PC (SmartScreen): klik tulisan Info lainnya (More info), lalu klik tombol Tetap jalankan (Run anyway). Ini wajar karena pemasang MiB belum ditandatangani secara digital. Bila ragu, periksa keasliannya dulu (lihat bagian di bawah).",
        "Di jendela pemasang, klik Next. Anda boleh membiarkan folder pemasangan seperti bawaannya, lalu klik Install.",
        "Tunggu sekitar satu menit sampai selesai. Biarkan kotak Run MiB tercentang, lalu klik Finish.",
        "MiB terbuka dengan sendirinya. Lanjutkan ke halaman Pengaturan awal. Lain kali, buka MiB lewat Start Menu (ketik MiB) atau ikon di desktop.",
      ] },
      { t: "h2", text: "Cara 2: satu baris di PowerShell" },
      { t: "p", text: "Cocok bila Anda terbiasa memakai PowerShell. Perintah ini mengunduh pemasang yang sama, memeriksa keasliannya, dan membatalkan pemasangan bila tidak cocok." },
      { t: "ol", items: [
        "Tekan tombol Windows di keyboard, ketik PowerShell, lalu tekan Enter.",
        "Salin perintah di bawah. Di jendela PowerShell, klik kanan sekali untuk menempel, lalu tekan Enter.",
      ] },
      { t: "code", text: "irm https://maninbot.id/download/install.ps1 | iex" },
      { t: "ul", items: [
        "Tunggu unduhan selesai. Jendela pemasang akan terbuka sendiri; lanjutkan seperti langkah 4 sampai 6 pada Cara 1.",
      ] },
      { t: "note", kind: "warn", text: "Hanya jalankan perintah semacam ini dari alamat yang Anda percaya. Pastikan alamatnya persis maninbot.id dan diawali https." },
      { t: "h2", text: "Memeriksa keaslian unduhan (opsional)" },
      { t: "p", text: "Halaman Unduh menampilkan kode SHA-256 pemasang. Untuk mencocokkannya, buka PowerShell lalu jalankan perintah ini dan bandingkan hasilnya:" },
      { t: "code", text: "Get-FileHash \"$env:USERPROFILE\\Downloads\\MiB-Setup.exe\" -Algorithm SHA256" },
      { t: "h2", text: "Memperbarui MiB" },
      { t: "p", text: "Pembaruan otomatis belum tersedia. Untuk memakai versi terbaru, unduh pemasang dari halaman Unduh dan jalankan seperti biasa; pemasang menimpa versi lama. Akun, percakapan, dan pengaturan Anda tetap aman." },
      { t: "h2", text: "Mencopot pemasangan" },
      { t: "p", text: "Buka Pengaturan Windows, Aplikasi, cari MiB, lalu klik Copot. Data Anda (percakapan dan pengaturan) sengaja tidak ikut terhapus; hapus foldernya sendiri bila ingin bersih total (lihat Pemecahan masalah)." },
    ],
  },
  {
    slug: "pengaturan-awal",
    group: "Memulai",
    title: "Pengaturan awal",
    summary: "Langkah setelah MiB terpasang: akun di komputer, akun MiB, folder kerja, lalu tugas pertama.",
    blocks: [
      { t: "p", text: "Setelah MiB terpasang, ada tiga hal yang diatur sebelum tugas pertama: akun di komputer ini, akun MiB, dan folder kerja. Totalnya sekitar 5 menit." },
      { t: "note", kind: "info", text: "Ada dua akun yang berbeda. Akun komputer ini dibuat di layar pertama dan hanya ada di komputer Anda, untuk masuk ke aplikasi. Akun MiB didaftarkan dengan email dan dipakai untuk mengaktifkan agen AI serta menghitung kuota harian. Keduanya diperlukan, tetapi fungsinya berbeda." },
      { t: "h2", text: "Langkah 1: buat akun di komputer ini" },
      { t: "ol", items: [
        "Buka MiB. Di layar pertama, klik Daftar.",
        "Isi nama, email, dan kata sandi. Data ini hanya dipakai untuk masuk ke aplikasi di komputer Anda.",
        "Klik Daftar. Akun pertama otomatis menjadi admin, yang berhak mengatur folder dan akun MiB.",
      ] },
      { t: "h2", text: "Langkah 2: masuk ke akun MiB" },
      { t: "ol", items: [
        "Buka Pengaturan (tautan Pengaturan di layar chat), lalu cari panel Akun MiB.",
        "Klik tab Daftar, isi email aktif dan kata sandi (minimal 8 karakter), lalu klik Daftar dan kirim kode.",
        "Buka email Anda dan salin kode 6 angka. Jika belum terlihat, periksa folder Spam. Kode berlaku 15 menit.",
        "Tempel kode di MiB, lalu klik Verifikasi.",
        "Panel berubah menjadi Masuk sebagai alamat email Anda, lengkap dengan sisa perintah hari ini. Agen sudah aktif.",
      ] },
      { t: "p", text: "Sudah pernah mendaftar? Pilih tab Masuk. Lupa kata sandi? Klik Lupa kata sandi di bawah kolom kata sandi dan ikuti kode yang dikirim ke email." },
      { t: "h2", text: "Langkah 3: pilih folder kerja" },
      { t: "ol", items: [
        "Buka Pengaturan, lalu Folder lokal.",
        "Klik tombol untuk memilih folder dan pilih folder tempat berkas kerja Anda, misalnya Dokumen. Untuk awal, folder khusus lebih aman daripada seluruh drive.",
        "Pilih modenya: Hanya baca bila MiB cukup melihat isinya, atau Baca dan tulis bila boleh membuat dan mengubah berkas. Lalu simpan.",
      ] },
      { t: "h2", text: "Langkah 4: coba tugas pertama" },
      { t: "p", text: "Kembali ke chat lalu ketik, misalnya: tolong lihat isi folder Dokumen dan ringkas berkas yang ada. Tindakan yang mengubah sesuatu akan menampilkan kartu izin; baca, lalu klik Izinkan atau Tolak." },
      { t: "h2", text: "Paket gratis dan berbayar" },
      { t: "table", head: ["Paket", "Perintah per hari", "Keterangan"], rows: [
        ["Gratis", "3", "Langsung aktif setelah akun MiB terverifikasi."],
        ["Berbayar", "30", "Berlaku 30 hari sejak pembayaran. Harga tertera di panel Akun MiB."],
      ] },
      { t: "ul", items: [
        "Satu perintah adalah satu pesan yang Anda kirim ke agen, berapa pun langkah yang dikerjakannya.",
        "Kuota diperbarui setiap hari pukul 00.00 WIB. Sisa kuota hari ini terlihat di panel Akun MiB.",
        "Untuk membayar, klik Bayar dan aktifkan di panel Akun MiB. Halaman pembayaran terbuka di browser (QRIS, transfer bank, atau e-wallet). Setelah bayar, status di MiB berubah sendiri dalam beberapa menit.",
      ] },
      { t: "h2", text: "Data akun Anda" },
      { t: "p", text: "Server MiB menyimpan email akun MiB, kata sandi dalam bentuk terenkripsi (bukan teks asli), jumlah perintah yang dipakai, dan riwayat pembayaran. Isi percakapan dan berkas Anda tidak disimpan di server." },
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
        "Sesi akun dan rahasia MiB tidak diwariskan ke perintah.",
        "Setiap perintah dan kode keluarnya dicatat di log audit.",
      ] },
      { t: "note", kind: "warn", text: "Perintah shell tidak berjalan di dalam sandbox. Setelah Anda menyetujui, perintah itu bisa mengubah atau menghapus isi folder yang diberi izin tulis. Baca perintahnya sebelum menekan Izinkan, dan ragukan perintah yang menghapus, memformat, atau mengubah pengaturan sistem." },
    ],
  },
  {
    slug: "keamanan",
    group: "Keamanan & tim",
    title: "Keamanan dan privasi",
    summary: "Apa yang tetap di komputer Anda, apa yang dikirim untuk diproses, dan bagaimana tindakan dijaga.",
    blocks: [
      { t: "h2", text: "Tetap di komputer Anda" },
      { t: "ul", items: [
        "Riwayat percakapan, akun di komputer ini, dan log audit.",
        "Pengaturan dan sesi akun MiB Anda.",
        "Seluruh berkas Anda. Tidak ada yang disimpan di server MiB; hanya bagian yang Anda minta dibaca agen yang ikut dikirim untuk diproses (lihat di bawah).",
      ] },
      { t: "h2", text: "Dikirim ke server MiB untuk diproses AI" },
      { t: "ul", items: [
        "Pesan Anda dan balasan percakapan.",
        "Isi berkas atau dokumen yang Anda minta agen baca.",
        "Tangkapan layar, hanya selama sesi kendali layar.",
      ] },
      { t: "p", text: "Server MiB memakai data itu hanya untuk memprosesnya dan menghitung kuota harian akun Anda. Isi percakapan, berkas, dan tangkapan layar tidak disimpan di server MiB." },
      { t: "h2", text: "Lapisan pengaman" },
      { t: "ol", items: [
        "Aplikasi di komputer Anda tidak bisa dijangkau dari jaringan; hanya Anda yang memakainya.",
        "Agen hanya bisa menyentuh folder yang Anda daftarkan.",
        "Tindakan yang mengubah sesuatu meminta persetujuan Anda, dan otomatis ditolak bila tidak dijawab dalam 5 menit.",
        "Kendali layar hanya untuk Microsoft Office; klik atau ketikan ke jendela lain diblokir, dan bisa dihentikan seketika dengan Esc atau menggerakkan mouse.",
        "Setiap tindakan penting tercatat di log audit.",
        "Isi berkas dan layar diperlakukan sebagai bahan bacaan, bukan perintah, untuk mengurangi risiko instruksi tersembunyi di dokumen.",
      ] },
      { t: "note", kind: "warn", text: "Tidak ada sistem yang kebal terhadap instruksi tersembunyi di dokumen atau halaman web. Karena itu persetujuan Anda tetap menjadi pengaman utama. Baca kartu izin sebelum menyetujui." },
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
      { t: "h2", text: "Windows memblokir pemasang (layar biru SmartScreen)" },
      { t: "p", text: "Pemasang MiB belum ditandatangani secara digital, sehingga Windows memperingatkan. Klik tulisan Info lainnya, lalu tombol Tetap jalankan. Cocokkan kode SHA-256 di halaman Unduh bila ingin yakin berkasnya asli." },
      { t: "h2", text: "MiB tidak mau terbuka atau langsung menutup" },
      { t: "ul", items: [
        "Pastikan tidak ada MiB lain yang sedang berjalan (cek Task Manager, cari MiB).",
        "Untuk melihat catatan galat, buka folder %APPDATA%\\mib-desktop\\data\\logs lalu berkas backend.log.",
      ] },
      { t: "h2", text: "Kode verifikasi email tidak sampai" },
      { t: "ul", items: [
        "Periksa folder Spam atau Promosi, lalu tunggu satu sampai dua menit.",
        "Pastikan alamat email yang diketik benar.",
        "Minta kode baru dengan klik Masuk di tab Masuk memakai email dan kata sandi yang sama; kode baru dikirim otomatis. Kode lama menjadi tidak berlaku.",
      ] },
      { t: "h2", text: "Muncul pesan tidak bisa terhubung ke server MiB" },
      { t: "p", text: "Periksa koneksi internet Anda. Bila memakai jaringan kantor, pastikan situs maninbot.id tidak diblokir oleh firewall. Coba lagi beberapa saat kemudian." },
      { t: "h2", text: "Lupa kata sandi akun MiB" },
      { t: "p", text: "Di Pengaturan, panel Akun MiB, tab Masuk, klik Lupa kata sandi. Masukkan email Anda, lalu isi kode 6 angka yang dikirim beserta kata sandi baru." },
      { t: "h2", text: "Agen meminta masuk akun, atau kuota habis" },
      { t: "p", text: "Buka Pengaturan dan masuk ke akun MiB. Jika muncul pesan batas perintah hari ini habis, tunggu pergantian hari pukul 00.00 WIB atau aktifkan paket berbayar di panel Akun MiB. Jika sudah membayar tetapi belum aktif, tunggu beberapa menit lalu buka ulang Pengaturan." },
      { t: "h2", text: "Agen tidak bisa melihat atau menulis di folder tertentu" },
      { t: "p", text: "Periksa Pengaturan, Folder lokal: folder harus terdaftar, dan untuk menulis atau menjalankan perintah modenya harus Baca dan tulis. Pintasan yang menuju keluar folder izin sengaja ditolak." },
      { t: "h2", text: "Kendali layar berhenti sendiri" },
      { t: "p", text: "Itu pengaman. Agen berhenti bila Anda menekan Esc atau menggerakkan mouse, bila jumlah aksi melebihi 300, atau bila layar menampilkan sesuatu yang tidak terduga. Mulai lagi dengan meminta tugas yang sama." },
      { t: "h2", text: "Mulai dari awal dan hapus semua data" },
      { t: "p", text: "Tutup MiB, lalu hapus folder %APPDATA%\\mib-desktop. Semua akun, percakapan, dan pengaturan (termasuk sesi akun MiB) ikut terhapus. Berkas Anda di folder lain tidak tersentuh." },
    ],
  },
];

export const docBySlug = (slug: string) => DOCS.find((d) => d.slug === slug);

export function neighbours(slug: string) {
  const i = DOCS.findIndex((d) => d.slug === slug);
  return { prev: i > 0 ? DOCS[i - 1] : null, next: i >= 0 && i < DOCS.length - 1 ? DOCS[i + 1] : null };
}
