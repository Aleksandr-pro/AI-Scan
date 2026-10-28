import { analyzeImage, computeImageMetrics, ImageInput } from '../src/core/imageAnalysis';
import { scoreToResult } from '../src/core/scoring';
import { synthImage } from '../testUtils/synth';

type Patch = { rgba: Uint8Array; size: number };

function crop(patch: { rgba: Uint8Array; width: number; height: number }): Patch {
  return { rgba: patch.rgba, size: patch.width };
}

function makeInput(
  flat: Patch,
  detail: Patch,
  overrides: Partial<ImageInput> = {},
): ImageInput {
  return {
    width: overrides.width ?? detail.size,
    height: overrides.height ?? detail.size,
    exif: {},
    tiles: { grid: 4, means: [], vars: [] },
    cropFlat: flat,
    cropDetail: detail,
    ...overrides,
  };
}

function hasId(list: { id: string }[], id: string): boolean {
  return list.some(i => i.id === id || i.id.endsWith(`_${id}`) || i.id.includes(id));
}

// --- Синтетические материалы ---
// «Камера»: ровный участок с зерном + текстурный участок с зерном.
const camFlat = crop(synthImage({ size: 320, noiseSigma: 3.2, textureOctaves: 0 }));
const camDetail = crop(synthImage({ size: 320, noiseSigma: 3.2, textureOctaves: 4 }));
// «ИИ»: апскейл с маленького размера, зерна нет.
const aiFlat = crop(
  synthImage({ size: 320, noiseSigma: 0.15, textureOctaves: 0, upscaleFrom: 64 }),
);
const aiDetail = crop(
  synthImage({ size: 320, noiseSigma: 0.15, textureOctaves: 2, upscaleFrom: 64 }),
);

describe('imageAnalysis: синтетическое «фото камеры»', () => {
  const input = makeInput(camFlat, camDetail);

  test('метрики соответствуют живой фотографии', () => {
    const m = computeImageMetrics(input);
    expect(m.flatNoise).toBeGreaterThan(1.5);
    expect(m.hfFloor).toBeGreaterThan(2.5);
  });

  test('появляется признак натурального зерна', () => {
    const ind = analyzeImage(input);
    expect(hasId(ind, 'noise_natural')).toBe(true);
    expect(hasId(ind, 'noise_too_clean')).toBe(false);
  });

  test('богатая микроструктура → признак человеческой съёмки', () => {
    const ind = analyzeImage(input);
    expect(hasId(ind, 'hf_rich') || hasId(ind, 'edges_dense')).toBe(true);
  });

  test('вердикт по пикселям + EXIF камеры → HUMAN', () => {
    const result = scoreToResult({
      indicators: analyzeImage(
        makeInput(camFlat, camDetail, {
          exif: { make: 'Apple', model: 'iPhone 15', datetime: '2026:05:01 09:30:00', gps: true },
          width: 3024,
          height: 4032,
        }),
      ),
      tech: { fileName: 'IMG_0042.jpg', fileSize: 2_500_000, mediaKind: 'photo' },
      stages: [],
      warnings: [],
      id: 't-cam',
    });
    expect(result.verdict).toBe('HUMAN');
    expect(result.confidence).toBeGreaterThanOrEqual(65);
  });
});

describe('imageAnalysis: синтетическая «ИИ-генерация»', () => {
  const input = makeInput(aiFlat, aiDetail);

  test('метрики соответствуют гладкой генерации', () => {
    const m = computeImageMetrics(input);
    expect(m.flatNoise).toBeLessThan(0.9);
    expect(m.detailNoise).toBeLessThan(1.2);
    expect(m.hfFloor).toBeLessThan(1.95);
  });

  test('нет натурального зерна, есть «слишком чистые» зоны', () => {
    const ind = analyzeImage(input);
    expect(hasId(ind, 'noise_too_clean')).toBe(true);
    expect(hasId(ind, 'noise_natural')).toBe(false);
  });

  test('пустой высокочастотный пол', () => {
    const ind = analyzeImage(input);
    expect(hasId(ind, 'hf_cutoff')).toBe(true);
  });

  test('гладкий «ИИ» файл без EXIF + размер 1024² → вердикт AI', () => {
    const result = scoreToResult({
      indicators: analyzeImage(makeInput(aiFlat, aiDetail, { width: 1024, height: 1024 })),
      tech: {
        fileName: 'gen.png',
        fileSize: 1_000_000,
        mediaKind: 'photo',
        width: 1024,
        height: 1024,
      },
      stages: [],
      warnings: [],
      id: 't1',
    });
    expect(result.verdict).toBe('AI');
    expect(result.confidence).toBeGreaterThanOrEqual(60);
  });
});

describe('imageAnalysis: метаданные', () => {
  test('EXIF камеры → сильный признак человека', () => {
    const ind = analyzeImage(
      makeInput(camFlat, camDetail, {
        exif: {
          make: 'Canon',
          model: 'EOS R6',
          datetime: '2025:05:01 10:00:00',
          iso: '400',
          gps: true,
        },
      }),
    );
    expect(hasId(ind, 'exif_camera_present')).toBe(true);
    expect(hasId(ind, 'exif_gps_present')).toBe(true);
    expect(hasId(ind, 'exif_missing')).toBe(false);
  });

  test('Software = Midjourney → признак ИИ', () => {
    const ind = analyzeImage(
      makeInput(camFlat, camDetail, { exif: { software: 'Midjourney Discord' } }),
    );
    const hit = ind.find(i => i.id === 'exif_software_ai');
    expect(hit).toBeDefined();
    expect(hit!.weight).toBe(45);
    expect(hit!.detail).toContain('генеративн');
  });

  test('нет EXIF → умеренный признак ИИ', () => {
    const ind = analyzeImage(makeInput(camFlat, camDetail));
    expect(hasId(ind, 'exif_missing')).toBe(true);
  });

  test('размер 1024×1792 → размеры генератора', () => {
    const ind = analyzeImage(makeInput(camFlat, camDetail, { width: 1024, height: 1792 }));
    expect(hasId(ind, 'dims_gen_pattern')).toBe(true);
  });

  test('размер экрана телефона → нейтрально', () => {
    const ind = analyzeImage(makeInput(camFlat, camDetail, { width: 1080, height: 2400 }));
    expect(hasId(ind, 'dims_screen')).toBe(true);
    expect(hasId(ind, 'dims_gen_pattern')).toBe(false);
  });

  test('строки файла с «stable diffusion» → сильный признак ИИ', () => {
    const ind = analyzeImage(
      makeInput(camFlat, camDetail, { fileStrings: 'junk\x00 Stable Diffusion v3 \x00' }),
    );
    expect(hasId(ind, 'content_ai_marker')).toBe(true);
  });

  test('строки файла с «NIKON» → признак человека', () => {
    const ind = analyzeImage(
      makeInput(camFlat, camDetail, { fileStrings: 'APP1\x00NIKON CORPORATION\x00NIKON D850' }),
    );
    expect(hasId(ind, 'content_camera_marker')).toBe(true);
  });
});

describe('imageAnalysis: периодический артефакт', () => {
  test('сетка в гладкой зоне детектируется', () => {
    const img = synthImage({ size: 320, noiseSigma: 0.2, textureOctaves: 0, checkerboard: 8 });
    const m = computeImageMetrics(makeInput(crop(img), crop(img)));
    expect(m.periodicPeak).toBeGreaterThan(0.35);
    const ind = analyzeImage(makeInput(crop(img), crop(img)));
    expect(hasId(ind, 'periodic_artifact')).toBe(true);
  });

  test('чистый шум/градиент без сетки — ложного срабатывания нет', () => {
    const img = synthImage({ size: 320, noiseSigma: 0.3, textureOctaves: 0 });
    const m = computeImageMetrics(makeInput(crop(img), crop(img)));
    expect(m.periodicPeak).toBeLessThan(0.35);
  });
});

describe('video-кадры: без EXIF-эвристик', () => {
  test('кадр не получает признаки EXIF/размеров', () => {
    const ind = analyzeImage(
      makeInput(camFlat, camDetail, { isVideoFrame: true, width: 1280, height: 720 }),
    );
    expect(hasId(ind, 'exif_missing')).toBe(false);
    expect(hasId(ind, 'dims_gen_pattern')).toBe(false);
    expect(hasId(ind, 'exif_camera_present')).toBe(false);
  });
});
