import { NativeModules } from 'react-native';

/** Результат разбора EXIF нативной стороной. */
export interface NativeExif {
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

export interface NativeImageAnalysis {
  width: number;
  height: number;
  exif: NativeExif;
  grid: number;
  tileMeans: number[];
  tileVars: number[];
  /** base64 сырых RGBA-данных гладкого кропа. */
  cropFlat: string;
  cropFlatSize: number;
  cropDetail: string;
  cropDetailSize: number;
}

export interface NativeVideoInfo {
  durationMs: number;
  width: number;
  height: number;
  hasAudio: boolean;
  hasVideo: boolean;
  bitrate: number;
  mimetype: string;
  frameRate?: number;
  /** Путы к извлечённым кадрам JPEG. */
  frames: Array<{ path: string; timeMs: number }>;
  /** ASCII-строки из контейнера (первые/последние мегабайты). */
  containerStrings: string;
  ftyp: string;
}

export interface NativeAudioPcm {
  pcmPath: string;
  sampleRate: number;
  originalSampleRate: number;
  channels: number;
  durationMs: number;
  stereoCorrelation?: number;
  mime: string;
  bitrate?: number;
}

interface NativeMediaSpec {
  analyzeImage(path: string): Promise<NativeImageAnalysis>;
  extractVideo(path: string, frameCount: number): Promise<NativeVideoInfo>;
  decodeAudio(path: string, maxSeconds: number): Promise<NativeAudioPcm>;
  /** Копия content:// → локальный файл; возвращает размер, байт. */
  copyFromContent(contentUri: string, destPath: string): Promise<number>;
}

const module: NativeMediaSpec | undefined = NativeModules.NativeMedia;

/**
 * Доступ к нативному модулю разбора медиа.
 * В среде Jest/отсутствия модуля — undefined, пайплайн деградирует осознанно.
 */
export const NativeMedia = module;

export function isNativeMediaAvailable(): boolean {
  return module !== undefined && module !== null;
}
