import { AnalysisResult, EvidenceSide } from './types';
import { sidePowers } from './scoring';

const SIDE_LABEL: Record<EvidenceSide, string> = {
  ai: 'в пользу ИИ',
  human: 'в пользу человека',
  neutral: 'нейтрально',
};

function fmtBytes(n: number): string {
  if (n >= 1024 * 1024) { return `${(n / (1024 * 1024)).toFixed(1)} МБ`; }
  if (n >= 1024) { return `${(n / 1024).toFixed(0)} КБ`; }
  return `${n} Б`;
}

function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return m > 0 ? `${m} мин ${rest} с` : `${rest} с`;
}

const KIND_LABEL = {
  photo: 'фото',
  video: 'видео',
  audio: 'аудио',
} as const;

const VERDICT_MARK: Record<string, string> = {
  AI: '[ИИ]',
  HUMAN: '[ЧЕЛОВЕК]',
  MIXED: '[СМЕШАНО]',
  UNCERTAIN: '[НЕОПРЕДЕЛЁННО]',
};

/** Формирует текстовый отчёт, который можно скопировать/отправить. */
export function buildReport(result: AnalysisResult): string {
  const lines: string[] = [];
  const t = new Date(result.createdAt);
  const dateStr = `${String(t.getDate()).padStart(2, '0')}.${String(t.getMonth() + 1).padStart(2, '0')}.${t.getFullYear()}, ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;

  lines.push('═══ AI SCAN — отчёт о проверке ═══');
  lines.push(`Файл: ${result.tech.fileName}`);
  lines.push(`Тип: ${KIND_LABEL[result.tech.mediaKind]} · ${fmtBytes(result.tech.fileSize)}`);
  lines.push(`Дата анализа: ${dateStr}`);
  lines.push('');
  lines.push(`ЗАКЛЮЧЕНИЕ: ${VERDICT_MARK[result.verdict]} ${result.verdictLabel}`);
  lines.push(`Уверенность: ${result.confidence}% · балл ${result.score >= 0 ? '+' : ''}${result.score} из ±100`);
  lines.push('');
  lines.push(result.summary);
  lines.push('');

  const powers = sidePowers(result.indicators);
  lines.push(`Сила сигналов: ИИ ${powers.ai} · человек ${powers.human}`);
  lines.push('');

  const groups: Array<[EvidenceSide, string]> = [
    ['ai', 'Признаки ИИ'],
    ['human', 'Признаки живой съёмки/записи'],
    ['neutral', 'Информационные наблюдения'],
  ];
  for (const [side, title] of groups) {
    const list = result.indicators
      .filter(i => i.side === side)
      .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
    if (list.length === 0) { continue; }
    lines.push(`── ${title} ──`);
    for (const ind of list) {
      const w = ind.weight > 0 ? `+${ind.weight}` : `${ind.weight}`;
      lines.push(`• ${ind.title} (${SIDE_LABEL[ind.side]}, вес ${w})`);
      lines.push(`  ${ind.detail}`);
      if (ind.evidence) {
        lines.push(`  Измерено: ${ind.evidence}`);
      }
    }
    lines.push('');
  }

  const tech = result.tech;
  const techLines: string[] = [];
  if (tech.width && tech.height) { techLines.push(`разрешение ${tech.width}×${tech.height}`); }
  if (tech.durationMs) { techLines.push(`длительность ${fmtDuration(tech.durationMs)}`); }
  if (tech.bitrate) { techLines.push(`${(tech.bitrate / 1000).toFixed(0)} кбит/с`); }
  if (tech.sampleRate) { techLines.push(`${tech.sampleRate} Гц`); }
  if (tech.channels) { techLines.push(`каналов: ${tech.channels}`); }
  if (tech.codec) { techLines.push(`кодек ${tech.codec}`); }
  if (tech.mimeType) { techLines.push(tech.mimeType); }
  if (tech.extra) {
    for (const [k, v] of Object.entries(tech.extra)) {
      if (v !== undefined && v !== '') { techLines.push(`${k}: ${v}`); }
    }
  }
  if (techLines.length) {
    lines.push('── Технические данные ──');
    lines.push(techLines.join(' · '));
    lines.push('');
  }

  if (result.stages.length) {
    lines.push(`Этапы: ${result.stages.join(' → ')}`);
  }
  if (result.warnings.length) {
    lines.push(`Примечания: ${result.warnings.join('; ')}`);
  }
  lines.push('');
  lines.push('Методика: эвристический анализ метаданных, статистики шума, частотных');
  lines.push('спектров и контейнера файла. Оценка вероятностная и не гарантирует');
  lines.push('100% результат — это инструмент первой линии проверки.');
  lines.push('═══════════════════════════════');
  return lines.join('\n');
}
