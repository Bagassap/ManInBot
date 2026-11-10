// Menandai apakah animasi pembuka sudah selesai di sesi halaman ini.
// Hidup di memori modul: hilang saat refresh/tab baru, tetap ada saat pindah halaman di dalam situs.
export const splashState = { shown: false };

/** Penundaan awal animasi hero agar baru mulai setelah animasi pembuka selesai. */
export const SPLASH_HOLD_S = 4.3;
export const heroDelay = () => (splashState.shown ? 0 : SPLASH_HOLD_S);
