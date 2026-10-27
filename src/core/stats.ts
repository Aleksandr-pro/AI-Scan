/** Элементарная статистика и вспомогательные функции для анализа. */

export function mean(values: ArrayLike<number>): number {
  const n = values.length;
  if (n === 0) { return 0; }
  let s = 0;
  for (let i = 0; i < n; i++) { s += values[i]; }
  return s / n;
}

export function variance(values: ArrayLike<number>): number {
  const n = values.length;
  if (n < 2) { return 0; }
  const m = mean(values);
  let s = 0;
  for (let i = 0; i < n; i++) {
    const d = values[i] - m;
    s += d * d;
  }
  return s / (n - 1);
}

export function std(values: ArrayLike<number>): number {
  return Math.sqrt(variance(values));
}

/** Стандартное отклонение, но как population std (для попиксельных карт). */
export function popStd(values: ArrayLike<number>): number {
  const n = values.length;
  if (n === 0) { return 0; }
  const m = mean(values);
  let s = 0;
  for (let i = 0; i < n; i++) {
    const d = values[i] - m;
    s += d * d;
  }
  return Math.sqrt(s / n);
}

export function median(sortedOrNot: number[]): number {
  if (sortedOrNot.length === 0) { return 0; }
  const a = [...sortedOrNot].sort((x, y) => x - y);
  const mid = a.length >> 1;
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) { return 0; }
  const a = [...values].sort((x, y) => x - y);
  const idx = Math.min(a.length - 1, Math.max(0, Math.floor(p * (a.length - 1))));
  return a[idx];
}

/** Коэффициент вариации (std / mean), защищённый от деления на 0. */
export function cv(values: ArrayLike<number>): number {
  const m = mean(values);
  if (Math.abs(m) < 1e-12) { return 0; }
  return std(values) / Math.abs(m);
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Извлекает яркость из сырых RGBA-данных.
 */
export function rgbaToLuma(rgba: Uint8Array | Buffer, width: number, height: number): Float32Array {
  const out = new Float32Array(width * height);
  const n = Math.min(out.length, rgba.length >> 2);
  for (let i = 0; i < n; i++) {
    const o = i << 2;
    out[i] = 0.299 * rgba[o] + 0.587 * rgba[o + 1] + 0.114 * rgba[o + 2];
  }
  return out;
}

/** Нормальная корреляция Пирсона двух равных выборок. */
export function correlation(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) { return 0; }
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
  ma /= n;
  mb /= n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma;
    const y = b[i] - mb;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  if (da <= 0 || db <= 0) { return 0; }
  return num / Math.sqrt(da * db);
}

/** Децibel: RMS → dBFS. */
export function rmsToDb(rms: number): number {
  if (rms <= 1e-10) { return -160; }
  return 20 * Math.log10(rms);
}
