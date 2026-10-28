import { fft, magnitudeSpectrum, hannWindow, isPow2, fft2Magnitude, fftShift2 } from '../src/core/fft';

describe('fft', () => {
  test('isPow2', () => {
    expect(isPow2(8)).toBe(true);
    expect(isPow2(9)).toBe(false);
    expect(isPow2(0)).toBe(false);
  });

  test('одна синусоида даёт пик на нужном бине', () => {
    const n = 1024;
    const k = 64;
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      re[i] = Math.cos((2 * Math.PI * k * i) / n);
    }
    fft(re, im, -1);
    let maxIdx = 0;
    let maxVal = 0;
    for (let i = 0; i < n; i++) {
      const mag = Math.hypot(re[i], im[i]);
      if (mag > maxVal) {
        maxVal = mag;
        maxIdx = i;
      }
    }
    expect(maxIdx).toBe(k);
    expect(maxVal).toBeCloseTo(n / 2, 0);
  });

  test('обратное БПФ возвращает исходный сигнал', () => {
    const n = 256;
    const orig = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      orig[i] = Math.sin(i * 0.37) * 10 + Math.cos(i * 0.11) * 3;
    }
    const re = Float64Array.from(orig);
    const im = new Float64Array(n);
    fft(re, im, -1);
    fft(re, im, 1);
    for (let i = 0; i < n; i++) {
      expect(re[i] / n).toBeCloseTo(orig[i], 6);
      expect(Math.abs(im[i])).toBeLessThan(1e-6);
    }
  });

  test('амплитудный спектр: шум даёт энергию по всему диапазону, тон — узкий пик', () => {
    const n = 4096;
    const sine = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      sine[i] = Math.cos((2 * Math.PI * 100 * i) / n);
    }
    const spec = magnitudeSpectrum(sine);
    expect(spec.length).toBe(n / 2);
    expect(spec[100]).toBeGreaterThan(spec[300]);
    expect(spec[100]).toBeGreaterThan(0.4);
    // Энергия вне пика мала
    let outside = 0;
    for (let k = 0; k < spec.length; k++) {
      if (Math.abs(k - 100) > 20) { outside += spec[k]; }
    }
    expect(outside / spec.length).toBeLessThan(0.01);
  });

  test('окно Ханна симметрично', () => {
    const w = hannWindow(64);
    expect(w[0]).toBeCloseTo(0, 6);
    expect(w[32]).toBeCloseTo(1, 2); // пик окна при N−1-нормировке
    expect(w[10]).toBeCloseTo(w[53], 6);
  });

  test('2D FFT центрирует DC и сохраняет симметрию', () => {
    const size = 64;
    const gray = new Float32Array(size * size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        gray[y * size + x] = 128 + 40 * Math.cos((2 * Math.PI * 8 * x) / size);
      }
    }
    const mag = fftShift2(fft2Magnitude(gray, size), size);
    const c = size / 2;
    // Пик на частоте 8 по X
    expect(mag[c * size + (c + 8)]).toBeGreaterThan(100);
    expect(mag[c * size + (c + 8)]).toBeCloseTo(mag[c * size + (c - 8)], 0);
    // DC в центре
    let maxVal = -1;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (mag[y * size + x] > maxVal) {
          maxVal = mag[y * size + x];
          maxX = x;
          maxY = y;
        }
      }
    }
    expect(maxX).toBe(c);
    expect(maxY).toBe(c);
  });
});
