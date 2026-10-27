import { clamp } from './stats';
import { AnalysisResult, EvidenceSide, Indicator, TechInfo, Verdict } from './types';

export interface ScoringInput {
  indicators: Indicator[];
  tech: TechInfo;
  stages: string[];
  warnings: string[];
  /** Идентификатор результата. */
  id: string;
  createdAt?: number;
}

const VERDICT_LABELS: Record<Verdict, string> = {
  AI: 'Создано или обработано ИИ',
  HUMAN: 'Создано человеком, без ИИ-обработки',
  MIXED: 'Смешанная обработка: человек + ИИ',
  UNCERTAIN: 'Недостаточно данных для вывода',
};

/**
 * Сводит список признаков к вердикту, уверенности и резюме.
 *
 * Правила:
 *  − признаки с weight > 0 тянут в пользу ИИ, weight < 0 — в пользу человека;
 *  − если обе стороны сильны одновременно (сильные ИИ- и человеческие
 *    признаки вместе) — это MIXED (материал человек делал, но правил ИИ);
 *  − при слабой сумме и малом числе независимых источников — UNCERTAIN.
 */
export function scoreToResult(input: ScoringInput): AnalysisResult {
  const { indicators, tech, stages, warnings, id } = input;
  const createdAt = input.createdAt ?? Date.now();

  let raw = 0;
  for (const ind of indicators) {
    raw += ind.weight;
  }

  // Сила каждой стороны.
  let aiPower = 0;
  let humanPower = 0;
  for (const ind of indicators) {
    if (ind.weight > 0) { aiPower += ind.weight; }
    else { humanPower += -ind.weight; }
  }

  // Разнообразие источников: сколько разных категорий дали вклад.
  const categories = new Set(indicators.filter(i => i.weight !== 0).map(i => i.category));

  // Независимые «столпы»: метаданные/контейнер и пиксельные/спектральные проверки.
  const hasMetaPillar = indicators.some(
    i => i.weight !== 0 && (i.category === 'metadata' || i.category === 'container'),
  );
  const hasPixelPillar = indicators.some(
    i =>
      i.weight !== 0 &&
      (i.category === 'noise' ||
        i.category === 'spectrum' ||
        i.category === 'structure' ||
        i.category === 'audio' ||
        i.category === 'temporal'),
  );
  const pillarCount = (hasMetaPillar ? 1 : 0) + (hasPixelPillar ? 1 : 0);

  const score = clamp(Math.round(raw * 0.55), -100, 100);

  let verdict: Verdict;
  const strongBoth = aiPower >= 40 && humanPower >= 40;
  if (strongBoth && Math.abs(aiPower - humanPower) < 60) {
    verdict = 'MIXED';
  } else if (score >= 28) {
    verdict = 'AI';
  } else if (score <= -28) {
    verdict = 'HUMAN';
  } else if (strongBoth) {
    verdict = 'MIXED';
  } else {
    verdict = 'UNCERTAIN';
  }

  // Уверенность: растёт с |score|, числом признаков и числом «столпов».
  let confidence = 30 + Math.abs(score) * 0.45 + categories.size * 4 + pillarCount * 8;
  if (verdict === 'UNCERTAIN') {
    confidence = Math.min(confidence, 55);
  }
  if (verdict === 'MIXED') {
    confidence = Math.min(confidence, 80);
  }
  if (verdict === 'AI' && hasMetaPillar && aiPower >= 40) {
    confidence += 6;
  }
  if (verdict === 'HUMAN' && hasMetaPillar && humanPower >= 30) {
    confidence += 6;
  }
  confidence = Math.round(clamp(confidence, 35, 96));

  const summary = buildSummary(verdict, confidence, aiPower, humanPower, indicators);

  return {
    id,
    createdAt,
    verdict,
    confidence,
    score,
    rawScore: Math.round(raw),
    verdictLabel: VERDICT_LABELS[verdict],
    summary,
    indicators,
    tech,
    stages,
    warnings,
  };
}

function topIndicator(indicators: Indicator[], side: EvidenceSide, take: number): Indicator[] {
  return indicators
    .filter(i => i.side === side && i.weight !== 0)
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
    .slice(0, take);
}

function buildSummary(
  verdict: Verdict,
  confidence: number,
  aiPower: number,
  humanPower: number,
  indicators: Indicator[],
): string {
  const topAi = topIndicator(indicators, 'ai', 2);
  const topHuman = topIndicator(indicators, 'human', 2);
  const aiPart = topAi.length
    ? `ИИ-признаки: ${topAi.map(i => i.title.toLowerCase()).join('; ')}`
    : 'Явных ИИ-признаков не найдено';
  const humanPart = topHuman.length
    ? `Признаки живой съёмки: ${topHuman.map(i => i.title.toLowerCase()).join('; ')}`
    : 'Метаданные камеры не обнаружены';

  switch (verdict) {
    case 'AI':
      return `Материал выглядит созданным или обработанным искусственным интеллектом (уверенность ${confidence}%). ${aiPart}. ${humanPart}.`;
    case 'HUMAN':
      return `Признаков ИИ-генерации почти нет: ${humanPart}. ${aiPart}. Совокупность данных соответствует обычной съёмке/записи человеком (уверенность ${confidence}%).`;
    case 'MIXED':
      return `Обнаружены одновременно признаки живой съёмки и ИИ-обработки (уверенность ${confidence}%). Похоже, материал был создан человеком, а затем частично обработан нейросетью. ${aiPart}. ${humanPart}.`;
    case 'UNCERTAIN':
    default:
      return `Однозначных доказательств ни в одну сторону нет (уверенность ${confidence}%). Сила сигналов: ИИ ${aiPower}, человек ${humanPower}. ${aiPart}. ${humanPart}.`;
  }
}

/** Числовые веса сторон — для экрана результата. */
export function sidePowers(indicators: Indicator[]): { ai: number; human: number; neutral: number } {
  let ai = 0;
  let human = 0;
  let neutral = 0;
  for (const i of indicators) {
    if (i.side === 'ai' && i.weight > 0) { ai += i.weight; }
    else if (i.side === 'human' && i.weight < 0) { human += -i.weight; }
    else { neutral += Math.abs(i.weight); }
  }
  return { ai, human, neutral };
}
