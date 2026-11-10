import { describe, expect, it } from 'vitest';
import { delta } from './admin.service.js';

describe('delta (perubahan persen vs periode sebelumnya)', () => {
  it('menghitung kenaikan dan penurunan', () => {
    expect(delta(150, 100)).toBe(50);
    expect(delta(75, 100)).toBe(-25);
  });
  it('tanpa pembanding: 0 bila sama-sama kosong, null bila baru muncul', () => {
    expect(delta(0, 0)).toBe(0);
    expect(delta(5, 0)).toBeNull();
  });
  it('turun ke nol = -100%', () => {
    expect(delta(0, 10)).toBe(-100);
  });
});
