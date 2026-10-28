import { AI_KEYWORDS, FFMPEG_MARKERS, findKeywords, HUMAN_KEYWORDS } from './keywords';
import { cv, mean } from './stats';
import { Indicator } from './types';
import { ImageMetrics } from './imageAnalysis';

export interface VideoContainerInfo {
  /** ASCII-строки из начала/конца файла. */
  fileStrings?: string;
  /** Крупный бренд контейнера (ftyp). */
  ftyp?: string;
}

export interface VideoMeta {
  durationMs?: number;
  width?: number;
  height?: number;
  hasAudio?: boolean;
  hasVideo?: boolean;
  bitrate?: number;
  mime?: string;
  frameRate?: number;
}

export interface VideoInput {
  container: VideoContainerInfo;
  meta: VideoMeta;
  /** Кадры: индикаторы (analyzeImage с isVideoFrame=true) + сырые метрики. */
  frames: Array<{ indicators: Indicator[]; metrics: ImageMetrics }>;
  /** Индикаторы аудиодорожки (если декодировалась). */
  audioIndicators?: Indicator[];
}

function scaleIndicator(ind: Indicator, factor: number): Indicator[] {
  if (ind.weight === 0) { return [ind]; }
  return [{ ...ind, weight: Math.round(ind.weight * factor) }];
}

/**
 * Агрегирует пиксельные признаки нескольких кадров в единый набор:
 * признак засчитывается, если проявился хотя бы в половине кадров.
 */
function aggregateFrameIndicators(frames: VideoInput['frames']): Indicator[] {
  if (frames.length === 0) { return []; }
  const out: Indicator[] = [];

  // 1. Стабильность зерна между кадрами.
  const flatSigmas = frames.map(f => f.metrics.flatNoise).filter(v => v >= 0);
  if (flatSigmas.length >= 3) {
    const m = mean(flatSigmas);
    const dispersion = m > 1e-6 ? cv(flatSigmas) : 0;
    const max = Math.max(...flatSigmas);
    const min = Math.min(...flatSigmas);
    if (dispersion > 0.7 && m > 0.4 && max > min * 3.5) {
      out.push({
        id: 'video_noise_unstable',
        category: 'temporal',
        side: 'ai',
        weight: 8,
        title: 'Зерно «прыгает» от кадра к кадру',
        detail:
          'Уровень шума в кадрах меняется несоизмеримо с освещением сцены. ' +
          'У настоящей камеры шум стабилен при одной экспозиции, а у видеогенераторов ' +
          'каждый кадр синтезируется заново и шум не совпадает.',
        evidence: `σ по кадрам: ${flatSigmas.map(v => v.toFixed(2)).join(', ')}`,
      });
    }
  }

  // 2. Средние значения пиксельных метрик по кадрам.
  const byId = new Map<string, { weights: number[]; sample: Indicator }>();
  for (const f of frames) {
    for (const ind of f.indicators) {
      if (ind.category !== 'noise' && ind.category !== 'spectrum' && ind.category !== 'structure') {
        continue;
      }
      const entry = byId.get(ind.id);
      if (entry) {
        entry.weights.push(ind.weight);
      } else {
        byId.set(ind.id, { weights: [ind.weight], sample: ind });
      }
    }
  }

  for (const [, { weights, sample }] of byId) {
    // Слабые сигналы показываем только если они подтвердились минимум на
    // 3 кадрах — на 1–2 кадрах «аномальная насыщенность» ничего не значит.
    if (weights.length < 3) { continue; }
    const avg = mean(weights);
    const agreement =
      weights.filter(w => Math.sign(w) === Math.sign(avg) && Math.abs(w) > 0).length / weights.length;
    if (agreement < 0.5 || Math.abs(avg) < 3) { continue; }
    out.push({
      ...sample,
      id: `frames_${sample.id}`,
      weight: Math.round(avg * 0.9),
      title: `${sample.title} (по кадрам видео)`,
      detail: sample.detail + ` Признак подтвердился в ${weights.length} кадрах из ${frames.length} проверенных.`,
    });
  }
  return out;
}

/** Анализ видео: контейнер + кадры + аудиодорожка. */
export function analyzeVideo(input: VideoInput): Indicator[] {
  const out: Indicator[] = [];

  // --- Контейнер ---
  const strings = (input.container.fileStrings || '').toLowerCase();
  const ai = findKeywords(strings, AI_KEYWORDS);
  const human = findKeywords(strings, HUMAN_KEYWORDS);
  const ffmpeg = FFMPEG_MARKERS.filter(f => strings.includes(f));

  if (ai.length > 0) {
    out.push({
      id: 'video_container_ai',
      category: 'container',
      side: 'ai',
      weight: 45,
      title: 'Подпись ИИ-генератора в контейнере',
      detail:
        'В служебных данных файла найдено имя системы генерации видео. ' +
        'Это прямая метка происхождения — её оставляет сам инструмент при записи/экспорте.',
      evidence: ai.map(a => a.label).slice(0, 5).join(', '),
    });
  }
  if (human.length > 0 && ai.length === 0) {
    out.push({
      id: 'video_container_device',
      category: 'container',
      side: 'human',
      weight: -30,
      title: 'Контейнер создан устройством (камерой/телефоном)',
      detail:
        'Служебные строки содержат маркеры аппаратного кодека, модели устройства или ' +
        'системного рекордера — так пишут видео обычные камеры. Генераторы такие ' +
        'метки не ставят.',
      evidence: human.map(h => h.label).slice(0, 5).join(', '),
    });
  }
  if (ffmpeg.length > 0 && ai.length === 0 && human.length === 0) {
    out.push({
      id: 'video_container_ffmpeg',
      category: 'container',
      side: 'ai',
      weight: 10,
      title: 'Пересборка контейнера через FFmpeg',
      detail:
        'Сигнатура Lavf/Lavc означает программную пересборку файла без аппаратной ' +
        'записи. Пайплайны генерации видео работают именно на FFmpeg; ' +
        'запись с камеры идёт мимо него.',
      evidence: ffmpeg.slice(0, 3).join(', '),
    });
  }

  // --- Кадры ---
  out.push(...aggregateFrameIndicators(input.frames));

  // --- Аудиодорожка ---
  if (input.audioIndicators) {
    for (const ind of input.audioIndicators) {
      out.push(...scaleIndicator(ind, 0.7).map(i => ({ ...i, id: `v_${i.id}` })));
    }
  } else if (input.meta.hasAudio === false) {
    const dur = (input.meta.durationMs || 0) / 1000;
    const exact = [5, 10, 15, 20].some(t => Math.abs(dur - t) <= 0.08);
    if (exact) {
      out.push({
        id: 'video_silent_exact',
        category: 'container',
        side: 'ai',
        weight: 4,
        title: 'Немое видео «пакетной» длительности',
        detail:
          'Аудиодорожки нет, а длина ровно 5/10/15/20 секунд — типичный формат ' +
          'выдачи коротких генеративных клипов.',
        evidence: `${dur.toFixed(2)} c, без звука`,
      });
    } else {
      out.push({
        id: 'video_silent',
        category: 'container',
        side: 'neutral',
        weight: 0,
        title: 'Аудиодорожка отсутствует',
        detail:
          'Звук в видео не найден — анализ вёлся только по изображению и контейнеру. ' +
          'Отсутствие звука само по себе не доказательство ни в одну сторону.',
        evidence: 'hasAudio = false',
      });
    }
  }

  return out;
}
