/** Pertanyaan yang sering diajukan; memakai details/summary agar tetap bisa dibuka tanpa JavaScript. */
export const FAQ_ITEMS: [string, string][] = [
  ["Apakah MiB aplikasi web?", "Bukan. Situs ini hanya tempat Anda mengenal dan mengunduh MiB. Agennya berjalan sebagai aplikasi di komputer Anda sendiri, memakai berkas dan aplikasi yang ada di sana."],
  ["Apakah MiB bisa dipakai untuk hal selain pekerjaan kantor?", "Tidak. MiB dirancang khusus untuk pekerjaan kantor: dokumen, data, berkas, dan aplikasi perkantoran. Permintaan di luar itu ditolak dengan sopan."],
  ["Apakah berkas saya disimpan di server MiB?", "Tidak. Berkas Anda tetap di komputer Anda. Agar agen bisa bekerja, isi percakapan dan bagian berkas yang Anda minta dibaca (serta tangkapan layar selama kendali layar) dikirim ke server MiB untuk diproses AI. Isinya tidak disimpan di server MiB."],
  ["Bisakah MiB bertindak tanpa izin saya?", "Membaca folder yang sudah Anda izinkan, ya. Untuk menulis berkas, menjalankan perintah, dan mengendalikan layar, MiB selalu meminta persetujuan Anda dulu, dan semuanya tercatat di log audit."],
  ["Berapa biayanya?", "Gratis 3 perintah per hari; paket berbayar membuka 30 perintah per hari. Satu perintah adalah satu pesan yang Anda kirim ke agen. Harga dan sisa kuota terlihat di Pengaturan aplikasi."],
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
