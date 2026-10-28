/** Форматирование значений для интерфейса. */

export function fmtBytes(n: number): string {
  if (n >= 1024 * 1024 * 1024) { return `${(n / (1024 ** 3)).toFixed(2)} ГБ`; }
  if (n >= 1024 * 1024) { return `${(n / (1024 * 1024)).toFixed(1)} МБ`; }
  if (n >= 1024) { return `${(n / 1024).toFixed(0)} КБ`; }
  return `${n} Б`;
}

export function fmtDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m <= 0) { return `${s} с`; }
  return `${m} мин ${String(s).padStart(2, '0')} с`;
}

export function fmtDate(ts: number): string {
  const d = new Date(ts);
  const dd = String(d.getDate()).padStart(2, '0');
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${dd}.${mo}.${d.getFullYear()} ${hh}:${mm}`;
}

export function fmtWeight(w: number): string {
  return w > 0 ? `+${w}` : `${w}`;
}

export const KIND_LABEL = {
  photo: 'Фото',
  video: 'Видео',
  audio: 'Аудио',
} as const;

export const KIND_ICON = {
  photo: '🖼️',
  video: '🎬',
  audio: '🎵',
} as const;

export const CATEGORY_LABEL: Record<string, string> = {
  metadata: 'Метаданные',
  container: 'Контейнер файла',
  noise: 'Статистика шума',
  spectrum: 'Спектральный анализ',
  structure: 'Структура кадра',
  temporal: 'Сквозной анализ',
  audio: 'Аудиоанализ',
  dimensions: 'Разрешение',
};
