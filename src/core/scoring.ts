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

/**
 * Правила v1.3:
 *  − балл = сумма показанных весов (без коэффициентов) — пользователь должен
 *    сверять «+45 −11 +5 = +31» с тем, что видит в списке признаков;
 *  − обе стороны ≥20 → MIXED «Противоречивые сигналы»;
 *  − |балл| ≥60 → сильная формулировка, 28…59 → «Скорее …»;
 *  − «Недостаточно данных» только когда данных действительно мало
 *    (суммарный вес сторон <12).
 */
const STRONG_AI = 60;
const STRONG_HUMAN = -60;
const LEAN = 28;
const MIN_POWER = 12;
const CONFLICT_SIDE = 20;

function labelFor(verdict: Verdict, score: number, power: number): string {
  switch (verdict) {
    case 'AI':
      return score >= STRONG_AI ? 'Создано или обработано ИИ' : 'Скорее ИИ';
    case 'HUMAN':
      return score <= STRONG_HUMAN
        ? 'Создано человеком, без ИИ-обработки'
        : 'Скорее настоящее';
    case 'MIXED':
      return 'Противоречивые сигналы';
    case 'UNCERTAIN':
    default:
      // «Недостаточно данных» — только когда данных действительно мало;
      // сигналы есть, но сошлись в ноль — говорим честно.
      return power < MIN_POWER
        ? 'Недостаточно данных для вывода'
        : 'Противоречивые сигналы';
  }
}

/**
 * Сводит список признаков к вердикту, уверенности и резюме.
 */
export function scoreToResult(input: ScoringInput): AnalysisResult {
  const { indicators, tech, stages, warnings, id } = input;
  const createdAt = input.createdAt ?? Date.now();

  let raw = 0;
  let aiPower = 0;
  let humanPower = 0;
  for (const ind of indicators) {
    raw += ind.weight;
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

  // Балл = сумма весов без масштабирования (см. контракт выше);
  // кламп нужен только для экстремальных сумм > ±100.
  const score = clamp(Math.round(raw), -100, 100);

  let verdict: Verdict;
  if (aiPower + humanPower < MIN_POWER) {
    verdict = 'UNCERTAIN';
  } else if (aiPower >= CONFLICT_SIDE && humanPower >= CONFLICT_SIDE) {
    verdict = 'MIXED';
  } else if (score >= LEAN) {
    verdict = 'AI';
  } else if (score <= -LEAN) {
    verdict = 'HUMAN';
  } else {
    // Данных есть (power ≥ MIN_POWER), но перевес слабый: склоняемся
    // в сторону большей силы при |балл| ≥ 15, иначе честный отказ от вывода.
    if (score >= 15) { verdict = 'AI'; }
    else if (score <= -15) { verdict = 'HUMAN'; }
    else { verdict = 'UNCERTAIN'; }
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

  const basis = buildBasis(indicators);
  const summary = buildSummary(verdict, confidence, aiPower, humanPower, indicators, basis);
  const power = aiPower + humanPower;

  return {
    id,
    createdAt,
    verdict,
    confidence,
    score,
    rawScore: Math.round(raw),
    verdictLabel: labelFor(verdict, score, power),
    summary,
    indicators,
    tech,
    stages,
    warnings,
  };
}

/** На чём основан вывод: метаданные/метки или анализ содержимого. */
export function buildBasis(indicators: Indicator[]): string {
  let meta = 0;
  let content = 0;
  for (const i of indicators) {
    if (i.weight === 0) { continue; }
    if (i.category === 'metadata' || i.category === 'container') {
      meta += Math.abs(i.weight);
    } else {
      content += Math.abs(i.weight);
    }
  }
  const total = meta + content;
  if (total === 0) { return 'данных для вывода нет'; }
  if (meta === 0) { return 'по анализу содержимого файла'; }
  if (content === 0) { return 'по метаданным и найденным меткам'; }
  if (meta >= content * 1.5) { return 'преимущественно по метаданным и меткам'; }
  if (content >= meta * 1.5) { return 'преимущественно по анализу содержимого'; }
  return 'по метаданным и анализу содержимого';
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
  basis: string,
): string {
  const topAi = topIndicator(indicators, 'ai', 2);
  const topHuman = topIndicator(indicators, 'human', 2);
  const aiPart = topAi.length
    ? `ИИ-признаки: ${topAi.map(i => i.title.toLowerCase()).join('; ')}`
    : 'Явных ИИ-признаков не найдено';
  const humanPart = topHuman.length
    ? `Признаки живой съёмки: ${topHuman.map(i => i.title.toLowerCase()).join('; ')}`
    : 'Метаданные камеры не обнаружены';

  // «Вывод по метаданным…» / особый случай пустых данных.
  const basisLine = basis.startsWith('данных')
    ? 'Данных для вывода нет.'
    : `Вывод ${basis[0].toUpperCase()}${basis.slice(1)}.`;

  switch (verdict) {
    case 'AI':
      return `Материал выглядит созданным или обработанным искусственным интеллектом (уверенность ${confidence}%). ${basisLine} ${aiPart}. ${humanPart}.`;
    case 'HUMAN':
      return `Признаков ИИ-генерации почти нет: ${humanPart}. ${aiPart}. Совокупность данных соответствует обычной съёмке/записи человеком (уверенность ${confidence}%). ${basisLine}`;
    case 'MIXED':
      return `Сигналы противоречат друг другу: ИИ ${aiPower} против человека ${humanPower} при уверенности ${confidence}%. Похоже, материал был создан человеком, а затем частично обработан нейросетью — либо статистика содержимого спорит с метаданными. ${basisLine} ${aiPart}. ${humanPart}.`;
    case 'UNCERTAIN':
    default:
      return `Однозначных доказательств ни в одну сторону нет (уверенность ${confidence}%). Сила сигналов: ИИ ${aiPower}, человек ${humanPower}. ${basisLine} ${aiPart}. ${humanPart}.`;
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

/** Строка «сумма признаков» для блока «Подробнее»: +45 +5 +4 −11 −7 −5 = +31. */
export function weightBreakdown(indicators: Indicator[]): string {
  const parts = indicators
    .filter(i => i.weight !== 0)
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
    .map(i => (i.weight > 0 ? `+${i.weight}` : `${i.weight}`));
  const sum = indicators.reduce((acc, i) => acc + i.weight, 0);
  const sumStr = sum > 0 ? `+${sum}` : `${sum}`;
  return parts.length ? `${parts.join(' ')} = ${sumStr}` : 'нет взвешенных признаков';
}
