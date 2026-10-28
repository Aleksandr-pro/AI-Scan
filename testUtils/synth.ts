/** Синтетические изображения для калибровки эвристик в Jest. */

/** Детерминированный ГПСЧ (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SynthOptions {
  size: number;
  /** Амплитуда гауссова зерна. */
  noiseSigma: number;
  /** Детализация: число октав value-noise (0 — без текстуры). */
  textureOctaves: number;
  /** Сглаживание (для «AI» — апскейл с маленького размера). */
  upscaleFrom?: number;
  /** Скрытый периодический артефакт (проверка сетки). */
  checkerboard?: number;
}

function gauss(r: () => number): number {
  // Бокс-Мюллер
  const u = Math.max(1e-9, r());
  const v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Value-noise текстура: интерполяция случайной сетки, несколько октав. */
function valueNoise(size: number, octaves: number, r: () => number): Float32Array {
  const out = new Float32Array(size * size);
  let amp = 1;
  let totalAmp = 0;
  for (let o = 0; o < octaves; o++) {
    const cells = 4 << o;
    const step = size / cells;
    const grid: number[] = [];
    for (let i = 0; i < (cells + 1) * (cells + 1); i++) {
      grid.push(r());
    }
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const gx = x / step;
        const gy = y / step;
        const x0 = Math.floor(gx);
        const y0 = Math.floor(gy);
        const fx = gx - x0;
        const fy = gy - y0;
        const sx = fx * fx * (3 - 2 * fx);
        const sy = fy * fy * (3 - 2 * fy);
        const g = (ix: number, iy: number) =>
          grid[Math.min(cells, iy) * (cells + 1) + Math.min(cells, ix)];
        const top = g(x0, y0) * (1 - sx) + g(x0 + 1, y0) * sx;
        const bot = g(x0, y0 + 1) * (1 - sx) + g(x0 + 1, y0 + 1) * sx;
        out[y * size + x] += (top * (1 - sy) + bot * sy) * amp;
      }
    }
    totalAmp += amp;
    amp *= 0.55;
  }
  for (let i = 0; i < out.length; i++) {
    out[i] /= totalAmp;
  }
  return out;
}

/**
 * Синтезирует RGBA-изображение «сцены».
 *  - textureOctaves>0 + sigma≥1.5  → похоже на фото камеры
 *  - upscaleFrom + малый sigma      → похоже на генерацию (гладкое)
 */
export function synthImage(opts: SynthOptions): { rgba: Uint8Array; width: number; height: number } {
  const { size, noiseSigma, textureOctaves, checkerboard } = opts;
  const r = rng(1337);
  const texture = textureOctaves > 0 ? valueNoise(size, textureOctaves, rng(777)) : null;

  const raw = new Float32Array(size * size * 3);

  if (opts.upscaleFrom && opts.upscaleFrom < size) {
    // Сначала рисуем маленькую картинку, потом билинейно апскейлим.
    const small = opts.upscaleFrom;
    const base = new Float32Array(small * small * 3);
    const texS = textureOctaves > 0 ? valueNoise(small, textureOctaves, rng(777)) : null;
    for (let y = 0; y < small; y++) {
      for (let x = 0; x < small; x++) {
        const i = (y * small + x) * 3;
        const u = x / small;
        const v = y / small;
        const t = texS ? texS[y * small + x] : 0.5;
        base[i] = 60 + 140 * u + 60 * t;
        base[i + 1] = 50 + 120 * v + 50 * t;
        base[i + 2] = 90 + 80 * (1 - u) + 40 * t;
      }
    }
    const scale = small / size;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const fx = Math.min(small - 1.001, x * scale);
        const fy = Math.min(small - 1.001, y * scale);
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const tx = fx - x0;
        const ty = fy - y0;
        const o = (y * size + x) * 3;
        for (let c = 0; c < 3; c++) {
          const p00 = base[(y0 * small + x0) * 3 + c];
          const p10 = base[(y0 * small + x0 + 1) * 3 + c];
          const p01 = base[((y0 + 1) * small + x0) * 3 + c];
          const p11 = base[((y0 + 1) * small + x0 + 1) * 3 + c];
          raw[o + c] =
            p00 * (1 - tx) * (1 - ty) +
            p10 * tx * (1 - ty) +
            p01 * (1 - tx) * ty +
            p11 * tx * ty;
        }
      }
    }
  } else {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 3;
        const u = x / size;
        const v = y / size;
        const t = texture ? texture[y * size + x] : 0.5;
        raw[i] = 55 + 130 * u + 70 * t;
        raw[i + 1] = 60 + 110 * v + 65 * t;
        raw[i + 2] = 80 + 90 * (1 - u) + 55 * t;
      }
    }
  }

  const rgba = new Uint8Array(size * size * 4);
  for (let p = 0; p < size * size; p++) {
    let n = noiseSigma > 0 ? gauss(r) * noiseSigma : 0;
    if (checkerboard) {
      const x = p % size;
      const y = (p / size) | 0;
      const bit = ((x / checkerboard) | 0) + ((y / checkerboard) | 0);
      n += (bit % 2 === 0 ? 1 : -1) * checkerboard;
    }
    for (let c = 0; c < 3; c++) {
      const v = raw[p * 3 + c] + n;
      rgba[p * 4 + c] = v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
    }
    rgba[p * 4 + 3] = 255;
  }
  return { rgba, width: size, height: size };
}

/** Оставляет только яркость в RGBA (для проверок). */
export function lumaToRgba(gray: Float32Array, size: number): Uint8Array {
  const out = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const v = Math.max(0, Math.min(255, Math.round(gray[i])));
    out[i * 4] = v;
    out[i * 4 + 1] = v;
    out[i * 4 + 2] = v;
    out[i * 4 + 3] = 255;
  }
  return out;
}
