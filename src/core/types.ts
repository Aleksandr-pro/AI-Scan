/** Типы вердиктов, которые выносит приложение. */
export type Verdict = 'AI' | 'HUMAN' | 'MIXED' | 'UNCERTAIN';

export type MediaKind = 'photo' | 'video' | 'audio';

export type EvidenceSide = 'ai' | 'human' | 'neutral';

export type IndicatorCategory =
  | 'metadata'
  | 'container'
  | 'noise'
  | 'spectrum'
  | 'structure'
  | 'temporal'
  | 'audio'
  | 'dimensions';

/** Один обнаруженный признак с объяснением «почему». */
export interface Indicator {
  /** Стабильный идентификатор признака (для истории/отчёта). */
  id: string;
  /** Группа признака. */
  category: IndicatorCategory;
  /** Какую сторону поддерживает признак: ИИ / человек / нейтральный. */
  side: EvidenceSide;
  /** Вес вклада в итоговую оценку (−100…+100, в пользу ИИ). */
  weight: number;
  /** Короткий заголовок признака. */
  title: string;
  /** Подробное объяснение: что показал анализ и почему это важно. */
  detail: string;
  /** Измеренное значение / техническая деталь. */
  evidence?: string;
}

/** Технические сведения о файле. */
export interface TechInfo {
  fileName: string;
  fileSize: number;
  mediaKind: MediaKind;
  mimeType?: string;
  /** Разрешение / размеры. */
  width?: number;
  height?: number;
  durationMs?: number;
  bitrate?: number;
  frameRate?: number;
  sampleRate?: number;
  channels?: number;
  codec?: string;
  extra?: Record<string, string | number | boolean | undefined>;
}

export interface AnalysisResult {
  id: string;
  createdAt: number;
  verdict: Verdict;
  /** Уверенность 0…100. */
  confidence: number;
  /** Итоговая невязка в пользу ИИ (−100…+100 после клампа). */
  score: number;
  /** Сумма весов до клампа. */
  rawScore: number;
  /** Человеко-читаемое название вердикта (RU). */
  verdictLabel: string;
  /** Краткое резюме (RU). */
  summary: string;
  indicators: Indicator[];
  tech: TechInfo;
  /** Какие этапы выполнялись. */
  stages: string[];
  /** Предупреждения (например, «декодирование недоступно»). */
  warnings: string[];
}

export interface AnalysisProgress {
  stage: string;
  /** 0…1 */
  progress: number;
}
