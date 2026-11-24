export const FAQ_ITEMS: [string, string][] = [
  ["Apakah MiB aplikasi web?", "Bukan. Situs ini hanya tempat Anda mengenal dan mengunduh MiB. Agennya berjalan sebagai aplikasi di komputer Anda sendiri, memakai berkas dan aplikasi yang ada di sana."],
  ["Apakah MiB bisa dipakai untuk hal selain pekerjaan kantor?", "Tidak. MiB dirancang khusus untuk pekerjaan kantor: dokumen, data, berkas, dan aplikasi perkantoran. Permintaan di luar itu ditolak dengan sopan."],
  ["Apakah data saya dikirim ke internet?", "Isi pekerjaan tidak. Otak MiB berjalan offline, jadi percakapan dan berkas tetap di komputer Anda. Yang tersimpan di server MiB hanya data akun: email, kata sandi terenkripsi, dan data diri. Internet dibutuhkan saat memasang dan saat masuk ke akun."],
  ["Bisakah MiB bertindak tanpa izin saya?", "Membaca folder yang sudah Anda izinkan, ya. Untuk menulis berkas, menjalankan perintah, dan mengendalikan layar, MiB selalu meminta persetujuan Anda dulu, dan semuanya tercatat di log audit."],
  ["Apakah MiB gratis?", "Ya. Versi offline dengan tiga model (Ringan untuk i3, Sedang untuk i5, Kuat untuk i7) gratis; cukup daftar akun MiB. Kecepatannya mengikuti prosesor dan RAM Anda. MiB Online akan tersedia."],
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
