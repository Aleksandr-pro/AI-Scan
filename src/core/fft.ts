/**
 * Итеративное БПФ (radix-2, in-place) и утилиты спектрального анализа.
 * Реализация чистая и детерминированная — покрывается тестами в Jest.
 */

/** Проверяет, что n — степень двойки. */
export function isPow2(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

/**
 * Комплексное БПФ: re/im — массивы длины n (n — степень двойки).
 * sign = -1 — прямое преобразование, +1 — обратное (без нормировки).
 */
export function fft(re: Float64Array, im: Float64Array, sign: -1 | 1): void {
  const n = re.length;
  if (!isPow2(n) || im.length !== n) {
    throw new Error('fft: длина должна быть степенью двойки');
  }
  // Реверс битов
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) {
      j ^= bit;
    }
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (sign * 2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curR = 1;
      let curI = 0;
      const half = len >> 1;
      for (let k = 0; k < half; k++) {
        const ur = re[i + k];
        const ui = im[i + k];
        const vr = re[i + k + half] * curR - im[i + k + half] * curI;
        const vi = re[i + k + half] * curI + im[i + k + half] * curR;
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[i + k + half] = ur - vr;
        im[i + k + half] = ui - vi;
        const nR = curR * wr - curI * wi;
        curI = curR * wi + curI * wr;
        curR = nR;
      }
    }
  }
}

/** Окно Ханна. */
export function hannWindow(n: number): Float64Array {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1 || 1)));
  }
  return w;
}

/**
 * Амплитудный спектр сигнала (magnitude на частотных бинах 0…n/2).
 * signal копируется, окно Ханна применяется автоматически.
 */
export function magnitudeSpectrum(signal: ArrayLike<number>): Float64Array {
  const n = signal.length;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  const w = hannWindow(n);
  for (let i = 0; i < n; i++) {
    re[i] = signal[i] * w[i];
  }
  fft(re, im, -1);
  const out = new Float64Array(n / 2);
  const scale = 2 / n;
  for (let k = 0; k < n / 2; k++) {
    out[k] = Math.hypot(re[k], im[k]) * scale;
  }
  return out;
}

/**
 * 2D амплитудный спектр квадратной карты яркости size×size.
 * Возвращает size×size массив |F| с DC в углу (fftshift-свободный порядок,
 * для анализа используется расстояние до нуля частоты в центре после shift).
 */
export function fft2Magnitude(gray: Float32Array, size: number): Float64Array {
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  const out = new Float64Array(size * size);
  const w = hannWindow(size);
  // По строкам
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      re[x] = gray[y * size + x] * w[x];
      im[x] = 0;
    }
    fft(re, im, -1);
    for (let x = 0; x < size; x++) {
      out[y * size + x] = Math.hypot(re[x], im[x]);
    }
  }
  // По столбцам
  const colRe = new Float64Array(size);
  const colIm = new Float64Array(size);
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      colRe[y] = out[y * size + x];
      colIm[y] = 0;
    }
    fft(colRe, colIm, -1);
    for (let y = 0; y < size; y++) {
      out[y * size + x] = Math.hypot(colRe[y], colIm[y]);
    }
  }
  return out;
}

/**
 * Строит «сдвинутый» спектр (нулевая частота в центре) из обычного порядка.
 */
export function fftShift2(mag: Float64Array, size: number): Float64Array {
  const half = size >> 1;
  const out = new Float64Array(size * size);
  for (let y = 0; y < size; y++) {
    const sy = (y + half) % size;
    for (let x = 0; x < size; x++) {
      const sx = (x + half) % size;
      out[sy * size + sx] = mag[y * size + x];
    }
  }
  return out;
}
