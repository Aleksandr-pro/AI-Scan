import { Indicator, TechInfo } from '../src/core/types';
import { scoreToResult, sidePowers } from '../src/core/scoring';
import { buildReport } from '../src/core/report';
import { analyzeVideo } from '../src/core/videoAnalysis';
import { ImageMetrics } from '../src/core/imageAnalysis';

function ind(partial: Partial<Indicator> & { id: string; weight: number; side: Indicator['side'] }): Indicator {
  return {
    category: 'metadata',
    title: partial.title || partial.id,
    detail: partial.detail || 'описание',
    ...partial,
  } as Indicator;
}

const tech: TechInfo = { fileName: 'x.jpg', fileSize: 1000, mediaKind: 'photo' };

describe('scoring', () => {
  test('сильные ИИ-признаки → AI', () => {
    const r = scoreToResult({
      indicators: [
        ind({ id: 'a', weight: 45, side: 'ai' }),
        ind({ id: 'b', weight: 14, side: 'ai', category: 'noise' }),
      ],
      tech, stages: [], warnings: [], id: '1',
    });
    expect(r.verdict).toBe('AI');
    expect(r.confidence).toBeGreaterThanOrEqual(70);
    expect(r.summary).toContain('искусственным интеллектом');
  });

  test('сильные признаки камеры → HUMAN', () => {
    const r = scoreToResult({
      indicators: [
        ind({ id: 'a', weight: -28, side: 'human' }),
        ind({ id: 'b', weight: -12, side: 'human', category: 'noise' }),
        ind({ id: 'c', weight: -8, side: 'human', category: 'spectrum' }),
        ind({ id: 'd', weight: -10, side: 'human' }),
      ],
      tech, stages: [], warnings: [], id: '2',
    });
    expect(r.verdict).toBe('HUMAN');
    expect(r.summary).toContain('живой');
  });

  test('обе стороны сильны → MIXED', () => {
    const r = scoreToResult({
      indicators: [
        ind({ id: 'a', weight: 45, side: 'ai' }),
        ind({ id: 'b', weight: 14, side: 'ai', category: 'noise' }),
        ind({ id: 'c', weight: -28, side: 'human' }),
        ind({ id: 'd', weight: -15, side: 'human', category: 'noise' }),
      ],
      tech, stages: [], warnings: [], id: '3',
    });
    expect(r.verdict).toBe('MIXED');
    expect(r.summary).toContain('частично обработан');
  });

  test('мало сигналов → UNCERTAIN', () => {
    const r = scoreToResult({
      indicators: [ind({ id: 'a', weight: 5, side: 'ai' })],
      tech, stages: [], warnings: [], id: '4',
    });
    expect(r.verdict).toBe('UNCERTAIN');
    expect(r.confidence).toBeLessThanOrEqual(55);
  });

  test('уверенность не достигает 100', () => {
    const r = scoreToResult({
      indicators: [
        ind({ id: 'a', weight: 45, side: 'ai' }),
        ind({ id: 'b', weight: 45, side: 'ai' }),
        ind({ id: 'c', weight: 45, side: 'ai' }),
        ind({ id: 'd', weight: -10, side: 'human' }),
      ],
      tech, stages: [], warnings: [], id: '5',
    });
    expect(r.confidence).toBeLessThanOrEqual(96);
    expect(r.confidence).toBeGreaterThanOrEqual(35);
  });

  test('sidePowers считает вклады', () => {
    const p = sidePowers([
      ind({ id: 'a', weight: 10, side: 'ai' }),
      ind({ id: 'b', weight: -5, side: 'human' }),
      ind({ id: 'c', weight: 0, side: 'neutral' }),
    ]);
    expect(p).toEqual({ ai: 10, human: 5, neutral: 0 });
  });
});

describe('report', () => {
  test('отчёт содержит вердикт, признаки и техданные', () => {
    const r = scoreToResult({
      indicators: [
        ind({
          id: 'exif_software_ai',
          weight: 45,
          side: 'ai',
          title: 'EXIF-ПО указывает на генератор ИИ',
          detail: 'В метаданных найдена подпись Midjourney.',
          evidence: 'Software = Midjourney',
        }),
        ind({
          id: 'noise_natural',
          weight: -12,
          side: 'human',
          category: 'noise',
          title: 'Натуральное зерно сенсора',
        }),
      ],
      tech: { ...tech, width: 1024, height: 1024, durationMs: 125000 },
      stages: ['Чтение файла', 'Расчёт вердикта'],
      warnings: ['тест'],
      id: 'r1',
      createdAt: Date.UTC(2026, 9, 27, 12, 0),
    });
    const text = buildReport(r);
    expect(text).toContain('AI SCAN');
    expect(text).toContain('x.jpg');
    expect(text).toContain('фото');
    expect(text).toContain('разрешение 1024×1024');
    expect(text).toContain('EXIF-ПО указывает');
    expect(text).toContain('Software = Midjourney');
    expect(text).toContain('Натуральное зерно');
    expect(text).toContain('тест');
    expect(text).toContain('Этапы:');
    expect(text).toContain('вероятностная');
  });
});

describe('videoAnalysis', () => {
  const metrics = (flat: number): ImageMetrics => ({
    hfFloor: 1.5,
    flatNoise: flat,
    detailNoise: 1,
    periodicPeak: 0,
    edgeDensity: 0,
    skinFraction: 0,
    meanSaturation: 0.3,
  });

  test('маркеры устройства → признак человека', () => {
    const out = analyzeVideo({
      container: {
        fileStrings: 'ftyp mp42 \x00 com.android.version:14 \x00 omx.qcom.video.encoder.avc',
      },
      meta: { hasAudio: true, durationMs: 15000 },
      frames: [],
    });
    expect(out.some(i => i.id === 'video_container_device')).toBe(true);
    expect(out.some(i => i.id === 'video_container_ai')).toBe(false);
  });

  test('маркер генератора → признак ИИ', () => {
    const out = analyzeVideo({
      container: { fileStrings: 'ftyp isom\x00 created by Sora 2 \x00 lavf61.1.100' },
      meta: { hasAudio: false, durationMs: 8000 },
      frames: [],
    });
    expect(out.some(i => i.id === 'video_container_ai')).toBe(true);
    expect(out.some(i => i.id === 'video_container_ffmpeg')).toBe(false);
  });

  test('нестабильное зерно между кадрами → признак ИИ', () => {
    const out = analyzeVideo({
      container: {},
      meta: { hasAudio: true, durationMs: 9000 },
      frames: [
        { indicators: [], metrics: metrics(1.0) },
        { indicators: [], metrics: metrics(6.0) },
        { indicators: [], metrics: metrics(1.5) },
        { indicators: [], metrics: metrics(5.5) },
      ],
    });
    expect(out.some(i => i.id === 'video_noise_unstable')).toBe(true);
  });

  test('нестабильное зерно отсутствует при стабильных кадрах', () => {
    const out = analyzeVideo({
      container: {},
      meta: { hasAudio: true, durationMs: 9000 },
      frames: [
        { indicators: [], metrics: metrics(3.0) },
        { indicators: [], metrics: metrics(3.2) },
        { indicators: [], metrics: metrics(2.9) },
      ],
    });
    expect(out.some(i => i.id === 'video_noise_unstable')).toBe(false);
  });

  test('немое видео «пакетной» длительности → лёгкий признак ИИ', () => {
    const out = analyzeVideo({
      container: {},
      meta: { hasAudio: false, durationMs: 10000 },
      frames: [],
    });
    expect(out.some(i => i.id === 'video_silent_exact')).toBe(true);
  });

  test('кадровые признаки взвешиваются и агрегируются', () => {
    const frameInd = [
      ind({ id: 'noise_too_clean', weight: 14, side: 'ai', category: 'noise' }),
    ];
    const out = analyzeVideo({
      container: {},
      meta: { hasAudio: true, durationMs: 9000 },
      frames: [
        { indicators: frameInd, metrics: metrics(3) },
        { indicators: frameInd, metrics: metrics(3.1) },
        { indicators: frameInd, metrics: metrics(3.2) },
      ],
    });
    const agg = out.find(i => i.id === 'frames_noise_too_clean');
    expect(agg).toBeDefined();
    expect(agg!.weight).toBe(Math.round(14 * 0.9));
    expect(agg!.detail).toContain('Проверено кадров: 3');
  });

  test('индикаторы аудиодорожки масштабируются', () => {
    const out = analyzeVideo({
      container: {},
      meta: { hasAudio: true, durationMs: 9000 },
      frames: [],
      audioIndicators: [
        ind({ id: 'audio_software_ai', weight: 45, side: 'ai', category: 'metadata' }),
      ],
    });
    const a = out.find(i => i.id === 'v_audio_software_ai');
    expect(a).toBeDefined();
    expect(a!.weight).toBe(Math.round(45 * 0.7));
  });
});
