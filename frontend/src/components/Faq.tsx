/** Pertanyaan yang sering diajukan; memakai details/summary agar tetap bisa dibuka tanpa JavaScript. */
export const FAQ_ITEMS: [string, string][] = [
  ["Apakah MiB aplikasi web?", "Bukan. Situs ini hanya tempat Anda mengenal dan mengunduh MiB. Agennya berjalan sebagai aplikasi di komputer Anda sendiri, memakai berkas dan aplikasi yang ada di sana."],
  ["Apakah MiB bisa dipakai untuk hal selain pekerjaan kantor?", "Tidak. MiB dirancang khusus untuk pekerjaan kantor: dokumen, data, berkas, dan aplikasi perkantoran. Permintaan di luar itu, misalnya game, hiburan, atau media sosial, ditolak dengan sopan."],
  ["Apakah berkas saya disimpan di server MiB?", "Tidak. Database, pengaturan, dan berkas tetap di komputer Anda. Hanya percakapan, isi berkas atau dokumen yang diminta agen untuk dibaca, dan tangkapan layar selama sesi kendali layar yang dikirim lewat server MiB ke layanan AI untuk diproses. Server MiB hanya meneruskan dan menghitung kuota; isinya tidak disimpan."],
  ["Bisakah MiB bertindak tanpa izin saya?", "Untuk membaca folder yang sudah Anda izinkan, ya. Untuk menulis berkas, membuat dokumen, menjalankan perintah, membuka aplikasi, dan mengendalikan layar, MiB selalu meminta persetujuan Anda dulu. Semuanya tercatat di log audit."],
  ["Bagaimana menghentikan MiB saat ia mengendalikan layar?", "Tekan Esc, gerakkan mouse sendiri, atau tekan tombol berhenti di chat. MiB langsung berhenti."],
  ["Apa yang saya butuhkan untuk memakainya?", "Windows 10/11 dan email aktif untuk membuat akun MiB. Layanan AI-nya sudah termasuk, jadi tidak ada kunci yang perlu Anda siapkan. Gratis 3 perintah per hari; untuk lebih banyak, ada paket berbayar dengan 30 perintah per hari. Harga dan sisa kuota terlihat di Pengaturan aplikasi."],
  ["Bagaimana dengan macOS dan Linux?", "Belum tersedia. Saat ini MiB dirilis untuk Windows lebih dulu."],
  ["Kenapa Windows memperingatkan saat memasang?", "Pemasang belum ditandatangani sehingga SmartScreen menampilkan peringatan. Anda bisa mencocokkan SHA-256 di halaman Unduh untuk memastikan berkasnya asli."],
];

export default function Faq() {
  return (
    <div className="divide-y divide-line rounded-2xl border border-line bg-surface">
      {FAQ_ITEMS.map(([q, a]) => (
        <details key={q} className="group px-5 py-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
            {q}
            <span aria-hidden className="text-muted transition-transform group-open:rotate-45">
              +
            </span>
          </summary>
          <p className="mt-3 text-sm leading-relaxed text-muted">{a}</p>
        </details>
      ))}
    </div>
  );
}
