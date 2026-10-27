import RNFS from 'react-native-fs';

import { base64ToAscii, base64ToBytes } from './base64';
import { analyzeAudio, AudioInput } from './audioAnalysis';
import { analyzeImageWithMetrics, CropData, ImageExif, ImageInput, ImageMetrics, ImageTiles } from './imageAnalysis';
import { analyzeVideo, VideoInput } from './videoAnalysis';
import { scoreToResult } from './scoring';
import { buildReport } from './report';
import { AnalysisProgress, AnalysisResult, Indicator, MediaKind, TechInfo } from './types';
import { isNativeMediaAvailable, NativeMedia } from '../native/NativeMedia';
import { parseWav } from './wav';

/** Максимальное число кадров видео для анализа. */
const VIDEO_FRAME_COUNT = 6;
/** Сколько кадров прогоняется через полный пиксельный анализ. */
const VIDEO_FRAMES_DEEP = 3;
/** Лимит чтения «строк» файла для поиска маркеров. */
const STRING_SCAN_HEAD = 2 * 1024 * 1024;
const STRING_SCAN_TAIL = 256 * 1024;
/** WAV разбирается в JS до этого размера, дальше — через нативный декодер. */
const WAV_JS_LIMIT = 40 * 1024 * 1024;
/** Сколько секунд аудио прогоняется через DSP. */
const AUDIO_MAX_SECONDS = 90;

const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'bmp'];
const VIDEO_EXT = ['mp4', 'mov', 'mkv', 'webm', 'avi', '3gp', 'm4v', 'ts', 'mpg', 'mpeg'];
const AUDIO_EXT = ['wav', 'mp3', 'm4a', 'aac', 'ogg', 'oga', 'flac', 'opus', 'amr', 'm4b', 'aiff', 'wma'];

export function detectKind(path: string, mime?: string | null): MediaKind {
  const clean = path.split('?')[0];
  const ext = (clean.split('.').pop() || '').toLowerCase();
  if (IMAGE_EXT.includes(ext)) { return 'photo'; }
  if (VIDEO_EXT.includes(ext)) { return 'video'; }
  if (AUDIO_EXT.includes(ext)) { return 'audio'; }
  // Если расширение неизвестно — используем MIME из пикера.
  if (mime) {
    if (mime.startsWith('image/')) { return 'photo'; }
    if (mime.startsWith('video/')) { return 'video'; }
    if (mime.startsWith('audio/')) { return 'audio'; }
  }
  // Фallback: считаем изображением (самый частый кейс).
  return 'photo';
}

/**
 * Приводит URI из пикера (file:///…, content://…) к локальному пути.
 *  - file:// → обычный путь с раскодированными %XX-последовательностями;
 *  - content:// → копия через нативный ContentResolver в кеш приложения.
 */
export function plainPathFromUri(uri: string): string {
  if (!uri) { return uri; }
  if (uri.startsWith('file://')) {
    let p = uri.slice('file://'.length);
    try {
      p = decodeURIComponent(p);
    } catch {
      // в имени были литеральные '%' — оставляем как есть
    }
    return p;
  }
  return uri;
}

export async function resolveLocalPath(raw: string, suggestedName?: string): Promise<string> {
  if (raw.startsWith('content://')) {
    if (!NativeMedia) {
      throw new Error('Нет доступа к файлу: нативный модуль не инициализирован');
    }
    const safe = (suggestedName || 'picked_file')
      .replace(/[\\/:*?"<>|]/g, '_')
      .slice(-80);
    const dest = `${RNFS.CachesDirectoryPath}/picked_${Date.now()}_${safe}`;
    await NativeMedia.copyFromContent(raw, dest);
    return dest;
  }
  return plainPathFromUri(raw);
}

/** Безопасно раскодирует имя файла (может прийти URL-encoded). */
export function safeDecodeName(name: string): string {
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

function yieldToUi(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

/** Читает начало/конец файла и извлекает ASCII-строки для поиска маркеров. */
async function readFileStrings(path: string): Promise<string> {
  try {
    const st = await RNFS.stat(path);
    const size = Number(st.size);
    const head = await RNFS.read(path, Math.min(STRING_SCAN_HEAD, size), 0, 'base64');
    let ascii = base64ToAscii(head);
    if (size > STRING_SCAN_HEAD) {
      const tailPos = Math.max(0, size - STRING_SCAN_TAIL);
      const tail = await RNFS.read(path, Math.min(STRING_SCAN_TAIL, size), tailPos, 'base64');
      ascii += '\n' + base64ToAscii(tail);
    }
    return ascii;
  } catch {
    return '';
  }
}

function fileNameOf(path: string): string {
  const noQuery = path.split('?')[0];
  const parts = noQuery.split('/');
  return parts[parts.length - 1] || noQuery;
}

async function fileInfo(path: string): Promise<{ size: number }> {
  try {
    const st = await RNFS.stat(path);
    return { size: Number(st.size) };
  } catch {
    return { size: 0 };
  }
}

function cropFromBase64(b64: string | undefined, size: number | undefined): CropData | undefined {
  if (!b64 || !size) { return undefined; }
  return { rgba: base64ToBytes(b64), size };
}

function exifFromNative(n: Record<string, any>): ImageExif {
  return {
    make: n.make || undefined,
    model: n.model || undefined,
    software: n.software || undefined,
    datetime: n.datetime || undefined,
    artist: n.artist || undefined,
    lensMake: n.lensMake || undefined,
    fNumber: n.fNumber || undefined,
    exposureTime: n.exposureTime || undefined,
    iso: n.iso || undefined,
    gps: Boolean(n.gps),
  };
}

/** Полный анализ одного изображения нативным модулем + эвристикой. */
async function analyzeOneImage(
  path: string,
  fileStrings: string | undefined,
  isVideoFrame: boolean,
): Promise<{
  indicators: Indicator[];
  metrics: ImageMetrics;
  tiles: ImageTiles;
  width: number;
  height: number;
  exif: ImageExif;
}> {
  if (!NativeMedia) {
    throw new Error('Нативный модуль анализа изображений недоступен');
  }
  const native = await NativeMedia.analyzeImage(path);
  const input: ImageInput = {
    width: native.width,
    height: native.height,
    exif: exifFromNative(native.exif || {}),
    tiles: {
      grid: native.grid,
      means: native.tileMeans || [],
      vars: native.tileVars || [],
    },
    cropFlat: cropFromBase64(native.cropFlat, native.cropFlatSize),
    cropDetail: cropFromBase64(native.cropDetail, native.cropDetailSize),
    fileStrings,
    isVideoFrame,
  };
  const outcome = analyzeImageWithMetrics(input);
  return {
    indicators: outcome.indicators,
    metrics: outcome.metrics,
    tiles: input.tiles,
    width: native.width,
    height: native.height,
    exif: input.exif,
  };
}

type ProgressFn = (p: AnalysisProgress) => void;

function progress(fn: ProgressFn | undefined, stage: string, value: number): Promise<void> {
  if (fn) {
    fn({ stage, progress: value });
  }
  return yieldToUi();
}

/** Читает .pcm (mono Int16 LE) из кеша в сэмплы. */
async function readPcmSamples(pcmPath: string, sampleRate: number): Promise<Int16Array> {
  const maxSamples = Math.floor(sampleRate * AUDIO_MAX_SECONDS);
  const st = await RNFS.stat(pcmPath);
  const bytesAvailable = Math.min(Number(st.size), maxSamples * 2);
  const b64 = await RNFS.read(pcmPath, bytesAvailable, 0, 'base64');
  const bytes = base64ToBytes(b64);
  const n = Math.floor(bytes.length / 2);
  const out = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = (bytes[i * 2] | (bytes[i * 2 + 1] << 8)) << 16 >> 16;
  }
  return out;
}

function isLossyAudio(path: string): boolean {
  const ext = (path.split('.').pop() || '').toLowerCase();
  return ['mp3', 'aac', 'm4a', 'ogg', 'oga', 'opus', 'amr', 'm4b', 'wma', '3gp'].includes(ext);
}

function isWav(path: string): boolean {
  return (path.split('.').pop() || '').toLowerCase() === 'wav';
}

/** Анализ аудио: WAV — в JS, остальное — через нативный MediaCodec. */
async function analyzeAudioFile(
  path: string,
  fileStrings: string,
  fileSize: number,
  onProgress: ProgressFn | undefined,
  warnings: string[],
  stages: string[],
  tech: TechInfo,
): Promise<Indicator[]> {
  await progress(onProgress, 'Декодирование звука', 0.45);
  stages.push('Декодирование звука');

  let input: AudioInput | null = null;

  if (isWav(path) && fileSize <= WAV_JS_LIMIT) {
    try {
      const b64 = await RNFS.readFile(path, 'base64');
      const bytes = base64ToBytes(b64);
      const wav = parseWav(bytes, AUDIO_MAX_SECONDS);
      input = {
        samples: wav.samples,
        sampleRate: wav.sampleRate,
        originalSampleRate: wav.sampleRate,
        channels: wav.channels,
        stereoCorrelation: wav.stereoCorrelation,
        durationMs: wav.durationMs,
        isLossy: false,
        fileStrings,
      };
      tech.sampleRate = wav.sampleRate;
      tech.channels = wav.channels;
      tech.durationMs = Math.round(wav.durationMs);
      tech.codec = wav.isFloat ? 'PCM float' : `PCM ${wav.bitsPerSample} бит`;
      stages.push('WAV-парсер (JS)');
    } catch (e) {
      warnings.push(`WAV не разобрался в JS (${String(e)}), пробуем нативный декодер`);
    }
  }

  if (!input) {
    if (NativeMedia) {
      try {
        const pcm = await NativeMedia.decodeAudio(path, AUDIO_MAX_SECONDS);
        const samples = await readPcmSamples(pcm.pcmPath, pcm.sampleRate);
        input = {
          samples,
          sampleRate: pcm.sampleRate,
          originalSampleRate: pcm.originalSampleRate,
          channels: pcm.channels,
          stereoCorrelation: pcm.stereoCorrelation,
          durationMs: pcm.durationMs,
          bitrate: pcm.bitrate,
          mime: pcm.mime,
          isLossy: isLossyAudio(path),
          fileStrings,
        };
        tech.sampleRate = pcm.originalSampleRate;
        tech.channels = pcm.channels;
        tech.durationMs = Math.round(pcm.durationMs);
        if (pcm.bitrate) { tech.bitrate = pcm.bitrate; }
        if (pcm.mime) { tech.codec = pcm.mime; }
        stages.push('Аппаратный декодер (MediaCodec)');
        try {
          await RNFS.unlink(pcm.pcmPath);
        } catch { /* не критично */ }
      } catch (e) {
        warnings.push(`Не удалось декодировать аудио: ${String(e)}. Анализ выполнен по метаданным.`);
      }
    } else {
      warnings.push('Нативный декодер недоступен: анализ выполнен по метаданным файла.');
    }
  }

  await progress(onProgress, 'Спектральный анализ аудио', 0.7);
  stages.push('Спектральный анализ');
  if (!input) {
    return analyzeAudio({ samples: new Int16Array(0), sampleRate: 44100, fileStrings, isLossy: isLossyAudio(path) })
      .filter(i => i.category === 'metadata' || i.category === 'container');
  }
  return analyzeAudio(input);
}

/** Главный пайплайн: файл → AnalysisResult. */
export async function runAnalysis(
  path: string,
  onProgress?: ProgressFn,
  options?: { mime?: string | null },
): Promise<AnalysisResult> {
  const kind = detectKind(path, options?.mime);
  const warnings: string[] = [];
  const stages: string[] = [];

  await progress(onProgress, 'Чтение файла', 0.08);
  stages.push('Чтение файла');

  // Валидация: файл должен существовать и быть не пустым.
  const pathExists = await RNFS.exists(path).catch(() => false);
  if (!pathExists) {
    throw new Error('Файл не найден — временная копия недоступна. Выберите файл заново.');
  }
  const { size } = await fileInfo(path);
  if (size <= 0) {
    throw new Error('Файл пуст (0 байт) — не удалось получить доступ к содержимому. Выберите файл заново.');
  }

  const tech: TechInfo = {
    fileName: safeDecodeName(fileNameOf(path)),
    fileSize: size,
    mediaKind: kind,
  };

  const fileStrings = await readFileStrings(path);

  await progress(onProgress, 'Поиск метаданных', 0.2);
  stages.push('Метаданные');

  let indicators: Indicator[] = [];

  if (kind === 'photo') {
    if (!isNativeMediaAvailable()) {
      warnings.push('Нативный модуль недоступен — выполнен анализ по метаданным.');
      indicators = [];
    } else {
      const img = await analyzeOneImage(path, fileStrings, false);
      indicators = img.indicators;
      tech.width = img.width;
      tech.height = img.height;
      if (img.exif.make || img.exif.model || img.exif.software || img.exif.datetime) {
        tech.extra = {
          ...(tech.extra || {}),
          camera: [img.exif.make, img.exif.model].filter(Boolean).join(' ') || undefined,
          software: img.exif.software,
          datetime: img.exif.datetime,
          iso: img.exif.iso,
          fNumber: img.exif.fNumber,
        };
      }
      stages.push('Пиксельный анализ');
      stages.push('Анализ спектра');
      await progress(onProgress, 'Анализ пикселей и спектров', 0.75);
    }
  } else if (kind === 'audio') {
    indicators = await analyzeAudioFile(
      path, fileStrings, size, onProgress, warnings, stages, tech,
    );
  } else {
    // --- видео ---
    await progress(onProgress, 'Извлечение кадров видео', 0.35);
    if (!NativeMedia) {
      warnings.push('Нативный модуль недоступен — анализ видео ограничен метаданными.');
      indicators = [];
    } else {
      let containerStrings = fileStrings;
      let meta: VideoInput['meta'] = {};
      const framesDeep: VideoInput['frames'] = [];
      try {
        const info = await NativeMedia.extractVideo(path, VIDEO_FRAME_COUNT);
        containerStrings = info.containerStrings || fileStrings;
        meta = {
          durationMs: info.durationMs,
          width: info.width,
          height: info.height,
          hasAudio: info.hasAudio,
          hasVideo: info.hasVideo,
          bitrate: info.bitrate,
          mime: info.mimetype,
          frameRate: info.frameRate,
        };
        tech.width = info.width;
        tech.height = info.height;
        tech.durationMs = info.durationMs;
        tech.mimeType = info.mimetype;
        if (info.bitrate) { tech.bitrate = info.bitrate; }
        if (info.frameRate) { tech.frameRate = info.frameRate; }
        if (info.ftyp) { tech.extra = { ...(tech.extra || {}), ftyp: info.ftyp }; }
        stages.push('Извлечение кадров');

        for (let i = 0; i < Math.min(VIDEO_FRAMES_DEEP, info.frames.length); i++) {
          await progress(
            onProgress,
            `Анализ кадра ${i + 1} из ${Math.min(VIDEO_FRAMES_DEEP, info.frames.length)}`,
            0.4 + (i / VIDEO_FRAMES_DEEP) * 0.3,
          );
          try {
            const fr = await analyzeOneImage(info.frames[i].path, undefined, true);
            framesDeep.push({ indicators: fr.indicators, metrics: fr.metrics });
          } catch (e) {
            warnings.push(`Кадр ${i + 1} не проанализирован: ${String(e)}`);
          }
        }
        stages.push('Пиксельный анализ кадров');
      } catch (e) {
        warnings.push(`Не удалось разобрать видео: ${String(e)}`);
      }

      // Аудиодорожка видео.
      let audioIndicators: Indicator[] | undefined;
      if (meta.hasAudio) {
        await progress(onProgress, 'Анализ звука из видео', 0.75);
        try {
          audioIndicators = await analyzeAudioFile(
            path, containerStrings, size, undefined, warnings, [], tech,
          );
          stages.push('Анализ звуковой дорожки');
        } catch (e) {
          warnings.push(`Звуковая дорожка не проанализирована: ${String(e)}`);
        }
      }

      await progress(onProgress, 'Сводка признаков видео', 0.85);
      indicators = analyzeVideo({
        container: { fileStrings: containerStrings },
        meta,
        frames: framesDeep,
        audioIndicators,
      });
      stages.push('Сводка признаков видео');
    }
  }

  await progress(onProgress, 'Формирование заключения', 0.95);
  stages.push('Расчёт вердикта');

  const result = scoreToResult({
    indicators,
    tech,
    stages,
    warnings,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  });

  await progress(onProgress, 'Готово', 1);
  return result;
}

export { buildReport };
