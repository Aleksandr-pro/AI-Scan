import { AI_DIMENSION_VALUES, AI_KEYWORDS, COMMON_SCREEN_DIMENSIONS, findKeywords, HUMAN_KEYWORDS } from './keywords';
import { clamp, rgbaToLuma } from './stats';
import { fft2Magnitude, fftShift2 } from './fft';
import { Indicator } from './types';

/** Сырые RGBA-данные кропа (base64 уже декодирован). */
export interface CropData {
  rgba: Uint8Array;
  size: number;
}

export interface ImageExif {
  make?: string;
  model?: string;
  software?: string;
  datetime?: string;
  artist?: string;
  lensMake?: string;
  fNumber?: string;
  exposureTime?: string;
  iso?: string;
  gps?: boolean;
}

export interface ImageTiles {
  grid: number;
  means: number[];
  vars: number[];
}

export interface ImageInput {
  width: number;
  height: number;
  exif: ImageExif;
  tiles: ImageTiles;
  cropFlat?: CropData;
  cropDetail?: CropData;
  /** ASCII-строки, найденные в начале файла (для поиска маркеров). */
  fileStrings?: string;
  /** Для кадров видео: без EXIF/размерных эвристик. */
  isVideoFrame?: boolean;
}

export interface ImageMetrics {
  /** σ высокочастотного пола (σ зерна), единицы яркости. */
  hfFloor: number;
  flatNoise: number;
  detailNoise: number;
  periodicPeak: number;
  edgeDensity: number;
  skinFraction: number;
  meanSaturation: number;
}

function blockResidualSigma(luma: Float32Array, w: number, h: number, block = 8): number {
  let acc = 0;
  let count = 0;
  const bw = Math.floor(w / block);
  const bh = Math.floor(h / block);
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      let s = 0;
      for (let y = 0; y < block; y++) {
        const row = (by * block + y) * w + bx * block;
        for (let x = 0; x < block; x++) {
          s += luma[row + x];
        }
      }
      const m = s / (block * block);
      for (let y = 0; y < block; y++) {
        const row = (by * block + y) * w + bx * block;
        for (let x = 0; x < block; x++) {
          const d = luma[row + x] - m;
          acc += d * d;
          count++;
        }
      }
    }
  }
  return count ? Math.sqrt(acc / count) : 0;
}

/** Центральный квадрат size×size из карты яркости w×h. */
function centerSquare(gray: Float32Array, w: number, h: number, size: number): Float32Array | null {
  if (w < size || h < size) { return null; }
  const x0 = Math.floor((w - size) / 2);
  const y0 = Math.floor((h - size) / 2);
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      out[y * size + x] = gray[(y0 + y) * w + x0 + x];
    }
  }
  return out;
}

/** Анализ спектра гладкой области: ищем периодические артефакты генерации. */
export function periodicPeakScore(gray256: Float32Array): number {
  const size = 256;
  const mag = fftShift2(fft2Magnitude(removePlane(gray256, size), size), size);
  const c = size / 2;
  const powers: number[] = [];
  const mags: number[] = [];
  let total = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.hypot(x - c, y - c);
      if (r >= 30 && r <= 110) {
        const v = mag[y * size + x];
        mags.push(v);
        const p = v * v;
        powers.push(p);
        total += p;
      }
    }
  }
  if (mags.length === 0 || total <= 0) { return 0; }
  const sorted = [...mags].sort((a, b) => a - b);
  const med = sorted[sorted.length >> 1] || 1e-9;
  let max = 0;
  for (const v of mags) { if (v > max) { max = v; } }
  const peakShare = (max * max) / total;
  const peakOverMedian = max / Math.max(med, 1e-9);
  // score ∈ [0..1]: насколько выражен одиночный периодический пик
  if (peakOverMedian < 40 || peakShare < 0.12) { return 0; }
  return clamp((peakOverMedian / 60) * (peakShare / 0.25), 0, 1);
}

/** Вычитает наилучшую плоскость a+b·x+c·y (МНК по 4 коэффициентам). */
function removePlane(src: Float32Array, size: number): Float32Array {
  const n = src.length;
  let sx = 0, sy = 0, sz = 0, sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const z = src[y * size + x];
      sx += x;
      sy += y;
      sz += z;
      sxx += x * x;
      syy += y * y;
      sxy += x * y;
      sxz += x * z;
      syz += y * z;
    }
  }
  // Разрешаем 3×3 систему методом Крамера (устойчиво достаточно).
  const det =
    sxx * (syy * n - sxy * sy) -
    sxy * (sxy * n - syy * sx) +
    sx * (sxy * sy - syy * sx);
  const out = new Float32Array(n);
  if (Math.abs(det) < 1e-9) {
    out.set(src);
    return out;
  }
  const detB =
    sxz * (syy * n - sxy * sy) -
    sxy * (syz * n - sxy * sz) +
    sx * (syz * sy - syy * sz);
  const dC =
    sxx * (syy * sz - syz * sy) -
    sxy * (sxy * sz - syz * sx) +
    sxz * (sxy * sy - syy * sx);
  const b = detB / det;
  const c = dC / det;
  const a = (sz - b * sx - c * sy) / n;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      out[y * size + x] = src[y * size + x] - (a + b * x + c * y);
    }
  }
  return out;
}

/**
 * Абсолютный «пол» высоких частот в единицах яркости (эксцесс-σ).
 *
 * Для белого шума с σ математическое ожидание |F|² на бине 2D-БПФ с
 * окнами Ханна = σ² · (Σw²)², где Σw² = N·3/8 = 96 при N=256.
 * Настоящее фото несёт сенсорное зерно (σ≈1.5…4) во всех частотах,
 * у сгенерированного изображения остаётся только квантование (σ<0.9).
 */
export function hfNoiseFloor(gray256: Float32Array): number {
  const size = 256;
  // Убираем линейный градиент (плоскость) — иначе утечка от наклона
  // попадает в высокие частоты и маскирует зерно.
  const detrended = removePlane(gray256, size);
  const mag = fftShift2(fft2Magnitude(detrended, size), size);
  const c = size / 2;
  const norm = 96 * 96; // (Σ Hann²)² для N=256
  let sum = 0;
  let n = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.hypot(x - c, y - c);
      if (r >= 60 && r <= 120) {
        sum += mag[y * size + x] ** 2;
        n++;
      }
    }
  }
  if (n === 0) { return 0; }
  return Math.sqrt(sum / n / norm);
}

function edgeDensityOf(luma: Float32Array, w: number, h: number): number {
  let edges = 0;
  let n = 0;
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const i = y * w + x;
      const g = Math.abs(luma[i + 1] - luma[i]) + Math.abs(luma[i + w] - luma[i]);
      if (g > 6) { edges++; }
      n++;
    }
  }
  return n ? edges / n : 0;
}

function skinFractionOf(rgba: Uint8Array, w: number, h: number): number {
  let skin = 0;
  let n = 0;
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const o = (y * w + x) << 2;
      const r = rgba[o];
      const g = rgba[o + 1];
      const b = rgba[o + 2];
      const mx = Math.max(r, g, b);
      const mn = Math.min(r, g, b);
      n++;
      if (
        r > 95 && g > 40 && b > 20 &&
        r > g && g >= b - 10 &&
        r - b >= 15 && r - b <= 135 &&
        mx - mn > 12 && r < 250
      ) {
        skin++;
      }
    }
  }
  return n ? skin / n : 0;
}

function meanSaturationOf(rgba: Uint8Array, w: number, h: number): number {
  let s = 0;
  let n = 0;
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const o = (y * w + x) << 2;
      const r = rgba[o];
      const g = rgba[o + 1];
      const b = rgba[o + 2];
      const mx = Math.max(r, g, b);
      const mn = Math.min(r, g, b);
      s += mx === 0 ? 0 : (mx - mn) / mx;
      n++;
    }
  }
  return n ? s / n : 0;
}

/** Считает метрики пиксельного анализа (null-кропы пропускаются). */
export function computeImageMetrics(input: ImageInput): ImageMetrics {
  const m: ImageMetrics = {
    hfFloor: -1,
    flatNoise: -1,
    detailNoise: -1,
    periodicPeak: -1,
    edgeDensity: -1,
    skinFraction: -1,
    meanSaturation: -1,
  };
  if (input.cropDetail) {
    const { rgba, size } = input.cropDetail;
    const gray = rgbaToLuma(rgba, size, size);
    m.detailNoise = blockResidualSigma(gray, size, size, 8);
    m.edgeDensity = edgeDensityOf(gray, size, size);
    m.skinFraction = skinFractionOf(rgba, size, size);
    m.meanSaturation = meanSaturationOf(rgba, size, size);
    const sq = centerSquare(gray, size, size, 256);
    if (sq) {
      m.hfFloor = hfNoiseFloor(sq);
    }
  }
  if (input.cropFlat) {
    const { rgba, size } = input.cropFlat;
    const gray = rgbaToLuma(rgba, size, size);
    m.flatNoise = blockResidualSigma(gray, size, size, 8);
    const sq = centerSquare(gray, size, size, 256);
    if (sq) {
      m.periodicPeak = periodicPeakScore(sq);
    }
  }
  return m;
}

function exifIndicators(input: ImageInput, out: Indicator[]): void {
  const ex = input.exif || {};
  const aiFromSw = ex.software ? findKeywords(ex.software, AI_KEYWORDS) : [];
  if (aiFromSw.length > 0) {
    out.push({
      id: 'exif_software_ai',
      category: 'metadata',
      side: 'ai',
      weight: 45,
      title: 'EXIF-ПО указывает на генератор ИИ',
      detail:
        'В метаданных файла поле Software/CreatorTool содержит подпись нейросетевого инструмента. ' +
        'Фотокамера и стандартные редакторы такую подпись не ставят — её оставляют генеративные сервисы.',
      evidence: `Software = «${ex.software}»`,
    });
  }
  const hasCamera = Boolean((ex.make && ex.make.trim()) || (ex.model && ex.model.trim()));
  if (hasCamera && input.isVideoFrame !== true) {
    out.push({
      id: 'exif_camera_present',
      category: 'metadata',
      side: 'human',
      weight: -28,
      title: 'Заполнены поля камеры (Make/Model)',
      detail:
        'Производитель и модель устройства записаны в EXIF. Генераторы изображений эти поля не ' +
        'заполняют — их наличие указывает на съёмку настоящим устройством.',
      evidence: [ex.make, ex.model].filter(Boolean).join(' '),
    });
  }
  if (ex.gps) {
    out.push({
      id: 'exif_gps_present',
      category: 'metadata',
      side: 'human',
      weight: -10,
      title: 'В файле есть GPS-метки',
      detail:
        'Теги геолокации пишутся камерой в момент съёмки. Удалить их при генерации обычно проще, ' +
        'чем подделать вместе с остальной цепочкой EXIF.',
      evidence: 'GPSLatitude/GPSLongitude присутствуют',
    });
  }
  if (ex.datetime && !hasCamera) {
    out.push({
      id: 'exif_datetime_only',
      category: 'metadata',
      side: 'neutral',
      weight: 0,
      title: 'Есть дата съёмки, но нет модели камеры',
      detail: 'Дата в EXIF есть, а Make/Model отсутствуют — метаданные выглядят неполными.',
      evidence: ex.datetime,
    });
  }
  const noExif =
    !hasCamera &&
    !ex.software &&
    !ex.datetime &&
    !ex.artist &&
    !ex.lensMake &&
    !ex.iso &&
    !ex.fNumber;
  if (noExif && input.isVideoFrame !== true) {
    out.push({
      id: 'exif_missing',
      category: 'metadata',
      side: 'ai',
      weight: 6,
      title: 'Метаданные EXIF полностью отсутствуют',
      detail:
        'Нет ни модели камеры, ни даты, ни выдержки. Так бывает у изображений, порождённых ' +
        'генераторами (или выгруженных из мессенджеров), тогда как у большинства фотографий ' +
        'с камеры EXIF сохраняется.',
      evidence: 'EXIF: пусто',
    });
  }
}

function dimensionIndicators(input: ImageInput, out: Indicator[]): void {
  if (input.isVideoFrame) { return; }
  const { width, height } = input;
  const isScreen = COMMON_SCREEN_DIMENSIONS.some(
    ([w, h]) => w === width && h === height,
  );
  if (isScreen) {
    out.push({
      id: 'dims_screen',
      category: 'dimensions',
      side: 'neutral',
      weight: 0,
      title: 'Разрешение как у экрана телефона',
      detail: 'Соотношение сторон и размер совпадают с экраном смартфона — вероятен скриншот.',
      evidence: `${width}×${height}`,
    });
    return;
  }
  const bothTarget =
    AI_DIMENSION_VALUES.has(width) && AI_DIMENSION_VALUES.has(height) &&
    width <= 2048 && height <= 2048;
  const square64 = width === height && width >= 256 && width <= 2048 && width % 64 === 0;
  if (bothTarget || square64) {
    out.push({
      id: 'dims_gen_pattern',
      category: 'dimensions',
      side: 'ai',
      weight: 12,
      title: 'Размер кадра совпадает с выходом генератора',
      detail:
        'Нейросети отдают изображения фиксированных размеров (512/768/1024/1792… и кратных 64). ' +
        'У фотографий с камеры размеры определяются сенсором и такими «круглыми» числами почти не бывают.',
      evidence: `${width}×${height}`,
    });
  }
}

function contentStringIndicators(input: ImageInput, out: Indicator[]): void {
  if (!input.fileStrings || input.isVideoFrame) { return; }
  const ai = findKeywords(input.fileStrings, AI_KEYWORDS);
  const human = findKeywords(input.fileStrings, HUMAN_KEYWORDS);
  if (ai.length > 0) {
    out.push({
      id: 'content_ai_marker',
      category: 'metadata',
      side: 'ai',
      weight: 44,
      title: 'Внутри файла найдена подпись ИИ-инструмента',
      detail:
        'Строки контейнера (EXIF/XMP/PNG-текст) содержат имя генеративной системы — это прямая ' +
        'метка происхождения, которую ставит сам инструмент.',
      evidence: ai.map(a => a.label).slice(0, 5).join(', '),
    });
  }
  if (human.length > 0 && ai.length === 0) {
    out.push({
      id: 'content_camera_marker',
      category: 'metadata',
      side: 'human',
      weight: -18,
      title: 'В файле найдены маркеры фототехники',
      detail:
        'Строки контейнера содержат названия производителей фото/видеотехники — так помечают ' +
        'файлы камеры и базовые библиотеки устройств.',
      evidence: human.map(h => h.label).slice(0, 5).join(', '),
    });
  }
}

function pixelIndicators(metrics: ImageMetrics, out: Indicator[], frameTag?: string): void {
  const id = (base: string) => (frameTag ? `${base}_${frameTag}` : base);

  if (metrics.flatNoise >= 0 && metrics.detailNoise >= 0) {
    if (metrics.flatNoise < 0.9 && metrics.detailNoise < 1.2) {
      out.push({
        id: id('noise_too_clean'),
        category: 'noise',
        side: 'ai',
        weight: 14,
        title: 'Полное отсутствие сенсорного шума',
        detail:
          'Даже в самых гладких участках и в текстуре попиксельные отклонения практически нулевые. ' +
          'Любая оптика и матрица дают зерно; у сгенерированных изображений шум субсидиарно ' +
          'гладкий, потому что пиксели порождаются моделью, а не измеряются сенсором.',
        evidence: `σ гладких зон = ${metrics.flatNoise.toFixed(2)}, σ текстуры = ${metrics.detailNoise.toFixed(2)}`,
      });
    } else if (metrics.flatNoise >= 1.5) {
      out.push({
        id: id('noise_natural'),
        category: 'noise',
        side: 'human',
        weight: -12,
        title: 'Натуральное зерно сенсора',
        detail:
          'В гладких областях есть характерный случайный шум — его даёт работающая матрица ' +
          'камеры. Генераторы такой шум почти не воспроизводят.',
        evidence: `σ гладких зон = ${metrics.flatNoise.toFixed(2)}`,
      });
    } else if (metrics.flatNoise < 0.9) {
      out.push({
        id: id('noise_flat_zones'),
        category: 'noise',
        side: 'ai',
        weight: 5,
        title: 'Гладкие зоны подозрительно чистые',
        detail:
          'В бездетальных участках почти нет шума, хотя в текстуре он присутствует — ' +
          'типичный след апскейла или подавления шума.',
        evidence: `σ гладких зон = ${metrics.flatNoise.toFixed(2)}`,
      });
    }
  }

  if (metrics.hfFloor >= 0) {
    if (metrics.hfFloor < 1.95) {
      out.push({
        id: id('hf_cutoff'),
        category: 'spectrum',
        side: 'ai',
        weight: 10,
        title: 'Высокочастотный пол практически пуст',
        detail:
          'Фурье-анализ текстурного участка не нашёл настоящего зерна в верхних частотах: ' +
          'микроструктура «сглажена» — типичный след генерации/апскейла без ' +
          'оптического шума матрицы.',
        evidence: `ВЧ-пол σ = ${metrics.hfFloor.toFixed(2)} (у снятого кадра обычно >3)`,
      });
    } else if (metrics.hfFloor > 3.0) {
      out.push({
        id: id('hf_rich'),
        category: 'spectrum',
        side: 'human',
        weight: -8,
        title: 'Настоящее зерно во всех частотах',
        detail:
          'Спектр плотно и равномерно заполнен верхними частотами — так звучит ' +
          'оптическое/сенсорное зерно настоящей съёмки, а не сглаженная генерация.',
        evidence: `ВЧ-пол σ = ${metrics.hfFloor.toFixed(2)}`,
      });
    }
  }

  if (metrics.periodicPeak >= 0 && metrics.periodicPeak > 0.35) {
    out.push({
      id: id('periodic_artifact'),
      category: 'spectrum',
      side: 'ai',
      weight: 18,
      title: 'Периодическая (сетчатая) артефактная структура',
      detail:
        'В спектре гладкой области вспыхивает узкая периодическая составляющая. ' +
        'В чистой зоне естественные сюжетные текстуры не дают таких пиков — периодическую ' +
        'решётку оставляют свёрточные/дискретизационные артефакты генеративных моделей и апскейлеров.',
      evidence: `выраженность пика = ${(metrics.periodicPeak * 100).toFixed(0)}%`,
    });
  }

  if (metrics.edgeDensity >= 0) {
    if (metrics.edgeDensity < 0.012) {
      out.push({
        id: id('edges_sparse'),
        category: 'structure',
        side: 'ai',
        weight: 8,
        title: 'Крайняя нехватка локальных деталей',
        detail:
          'Доля пикселей с выраженными градиентами аномально мала: структура кадра ' +
          'слишком «мягкая», как у diffusion-выхода без проявленной фактуры.',
        evidence: `плотность краёв = ${(metrics.edgeDensity * 100).toFixed(2)}%`,
      });
    } else if (metrics.edgeDensity > 0.15) {
      out.push({
        id: id('edges_dense'),
        category: 'structure',
        side: 'human',
        weight: -6,
        title: 'Высокая плотность настоящих деталей',
        detail:
          'Огромное количество мелких граней и фактур — признак реальной сцены, ' +
          'снятой оптикой, а не «нарисованной» моделью.',
        evidence: `плотность краёв = ${(metrics.edgeDensity * 100).toFixed(2)}%`,
      });
    }
  }

  if (
    metrics.skinFraction > 0.35 &&
    metrics.detailNoise >= 0 &&
    metrics.detailNoise < 1.2 &&
    metrics.flatNoise >= 0 &&
    metrics.flatNoise < 0.8
  ) {
    out.push({
      id: id('skin_smooth'),
      category: 'structure',
      side: 'ai',
      weight: 10,
      title: 'Кожа без пор и микротекстуры',
      detail:
        'В кадре много участков цвета кожи, но они идеально гладкие. ' +
        'У генеративных моделей кожа часто выглядит «пластиковой» — без пушинок, пор и зерна.',
      evidence: `доля «кожи» = ${(metrics.skinFraction * 100).toFixed(0)}%`,
    });
  }

  if (metrics.meanSaturation >= 0 && metrics.meanSaturation > 0.52) {
    out.push({
      id: id('saturation_high'),
      category: 'structure',
      side: 'ai',
      weight: 5,
      title: 'Аномально насыщенная цветовая гамма',
      detail:
        'Средняя насыщенность заметно выше типичной фотографии — генераторы склонны ' +
        'выдавать «праздничные», перекрашенные изображения.',
      evidence: `насыщенность = ${(metrics.meanSaturation * 100).toFixed(0)}%`,
    });
  }
}

export interface ImageAnalysisOutcome {
  indicators: Indicator[];
  metrics: ImageMetrics;
}

/**
 * Полный анализ изображения: метаданные + пиксельные/спектральные эвристики.
 * Возвращает и признаки, и сырые метрики (нужны для видео-агрегации).
 */
export function analyzeImageWithMetrics(input: ImageInput): ImageAnalysisOutcome {
  const out: Indicator[] = [];
  if (!input.isVideoFrame) {
    exifIndicators(input, out);
    dimensionIndicators(input, out);
    contentStringIndicators(input, out);
  }
  const metrics = computeImageMetrics(input);
  pixelIndicators(metrics, out);
  return { indicators: out, metrics };
}

/** Анализ изображения → только признаки. */
export function analyzeImage(input: ImageInput): Indicator[] {
  return analyzeImageWithMetrics(input).indicators;
}
