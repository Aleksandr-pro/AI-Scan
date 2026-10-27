import { AI_KEYWORDS, FFMPEG_MARKERS, findKeywords, HUMAN_KEYWORDS } from './keywords';
import { mean, percentile, popStd, rmsToDb } from './stats';
import { magnitudeSpectrum } from './fft';
import { Indicator } from './types';

export interface AudioInput {
  /** Моно-сэмплы (PCM 16 бит, приведённые к одному каналу). */
  samples: Int16Array;
  /** Частота дискретизации данных в samples. */
  sampleRate: number;
  /** Исходная частота файла (до любого ресемплинга). */
  originalSampleRate?: number;
  /** Исходное число каналов. */
  channels?: number;
  /** Корреляция L/R для стерео (−1…1); считается нативной стороной или в JS. */
  stereoCorrelation?: number;
  durationMs?: number;
  bitrate?: number;
  mime?: string;
  /** true, если файл был закодирован в lossy-формат (mp3/aac/ogg). */
  isLossy?: boolean;
  /** ASCII-строки из контейнера (ID3, Vorbis-комментарии и т.п.). */
  fileStrings?: string;
}

export interface AudioMetrics {
  silenceFloorDb: number;
  zeroRunMs: number;
  longestZeroRunMs: number;
  cutoffHz: number | null;
  rmsStdDb: number;
  stationaryCv: number;
  rmsDbMedian: number;
  /** Сколько окон считается тихими (≤ −52 дБ) — кандидатов на паузы. */
  quietWindowCount: number;
  /** Сколько окон содержит активный звук (> −52 дБ). */
  activeWindowCount: number;
}

const WIN = 8192;

function windowRmsDb(samples: Int16Array, rate: number, winSec = 0.4): Array<{ db: number; rms: number }> {
  const win = Math.max(256, Math.floor(rate * winSec));
  const hop = win;
  const out: Array<{ db: number; rms: number }> = [];
  const norm = 32768;
  for (let start = 0; start + win <= samples.length; start += hop) {
    let acc = 0;
    for (let i = 0; i < win; i++) {
      const v = samples[start + i] / norm;
      acc += v * v;
    }
    const rms = Math.sqrt(acc / win);
    out.push({ db: rmsToDb(rms), rms });
  }
  return out;
}

/** Самая длинная последовательность «цифровой тишины» (|s| <= 1) в мс. */
export function zeroRunStats(samples: Int16Array, rate: number): { totalMs: number; longestMs: number; runs: number } {
  let cur = 0;
  let total = 0;
  let longest = 0;
  let runs = 0;
  const minRun = Math.floor(rate * 0.05); // ≥ 50 мс
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (s <= 1 && s >= -1) {
      cur++;
    } else {
      if (cur >= minRun) {
        runs++;
        total += cur;
        if (cur > longest) { longest = cur; }
      }
      cur = 0;
    }
  }
  if (cur >= minRun) {
    runs++;
    total += cur;
    if (cur > longest) { longest = cur; }
  }
  return {
    totalMs: (total / rate) * 1000,
    longestMs: (longest / rate) * 1000,
    runs,
  };
}

/**
 * Верхняя рабочая частота: спектр сглаживается скользящим средним,
 * затем ищется самая высокая частота, где он ещё выше 10% энергии
 * середины диапазона. Резкое падение (стена на 15–16 кГц) — визитная
 * карточка нейро-вокодеров; равномерный спектр до Найквиста означает
 * полный диапазон живой записи.
 */
export function spectralCutoff(samples: Int16Array, rate: number): number | null {
  const n = Math.min(samples.length, WIN * 16);
  if (n < WIN * 2) { return null; }
  const step = Math.floor((n - WIN) / 12);
  const avg = new Float64Array(WIN / 2);
  let used = 0;
  for (let off = 0; off + WIN <= n && used < 13; off += step) {
    const chunk = new Float64Array(WIN);
    for (let i = 0; i < WIN; i++) {
      chunk[i] = samples[off + i] / 32768;
    }
    const mag = magnitudeSpectrum(chunk);
    for (let k = 0; k < mag.length; k++) {
      avg[k] += mag[k];
    }
    used++;
  }
  if (used === 0) { return null; }
  for (let k = 0; k < avg.length; k++) { avg[k] /= used; }

  // Сглаживание (~сотни Гц): убирает случайные провалы Рэлея.
  const bins = avg.length;
  const W = 128;
  const smooth = new Float64Array(bins);
  let run = 0;
  for (let k = 0; k < bins + W; k++) {
    if (k < bins) { run += avg[k]; }
    if (k >= W) { run -= avg[k - W]; }
    if (k >= W - 1) {
      const idx = k - W + 1;
      if (idx < bins) { smooth[idx] = run / W; }
    }
  }

  const nyquist = rate / 2;
  const midLo = Math.floor(bins * 0.45);
  const midHi = Math.floor(bins * 0.70);
  let midMean = 0;
  for (let k = midLo; k < midHi; k++) { midMean += smooth[k]; }
  midMean /= Math.max(1, midHi - midLo);
  if (midMean <= 1e-12) { return null; }
  const thr = midMean * 0.10;

  let cutBin = -1;
  for (let k = bins - 1; k >= midHi; k--) {
    if (smooth[k] > thr) {
      cutBin = k;
      break;
    }
  }
  if (cutBin < 0) { return null; }
  return ((cutBin + 1) / bins) * nyquist;
}

/** Временная стационарность ВЧ-полос: CV энергии по окнам, медиана по 8 полосам. */
export function highBandStationarity(samples: Int16Array): number {
  const n = samples.length;
  const win = WIN;
  if (n < win * 4) { return -1; }
  const hop = Math.floor((n - win) / 10);
  const bands = 8;
  const binCount = WIN / 2;
  const bandEnergy: number[][] = Array.from({ length: bands }, () => []);
  for (let off = 0; off + win <= n && bandEnergy[0].length < 10; off += hop) {
    const chunk = new Float64Array(win);
    for (let i = 0; i < win; i++) {
      chunk[i] = samples[off + i] / 32768;
    }
    const mag = magnitudeSpectrum(chunk);
    for (let b = 0; b < bands; b++) {
      const lo = Math.floor((binCount * b) / bands);
      const hi = Math.floor((binCount * (b + 1)) / bands);
      let e = 0;
      for (let k = lo; k < hi; k++) {
        e += mag[k] * mag[k];
      }
      bandEnergy[b].push(e);
    }
  }
  const cvs: number[] = [];
  // анализируем верхние 4 полосы — там у настоящего материала больше «живого» шума
  for (let b = Math.floor(bands / 2); b < bands; b++) {
    const arr = bandEnergy[b];
    if (arr.length < 5) { continue; }
    const m = mean(arr);
    if (m <= 1e-14) { continue; }
    cvs.push(popStd(arr) / m);
  }
  if (cvs.length === 0) { return -1; }
  cvs.sort((a, b) => a - b);
  return cvs[cvs.length >> 1];
}

/** Считает метрики аудио. */
export function computeAudioMetrics(input: AudioInput): AudioMetrics {
  const s = input.samples;
  const rate = input.sampleRate;
  const windows = windowRmsDb(s, rate);
  const active = windows.filter(w => w.db > -52).map(w => w.db);
  const all = windows.map(w => w.db);

  const quiet = all.filter(d => d < -40);
  const silenceFloorDb = quiet.length
    ? percentile(quiet, 0.1)
    : percentile(all, 0.05);

  const zero = zeroRunStats(s, rate);

  // Динамика считается по ВСЕЙ ленте, включая паузы: живые записи сильно
  // меняют уровень между репликами/куплетами, а компактная генерация держит
  // одну и ту же энергию от начала до конца. Раньший расчёт только по активным
  // окнам делал AGC-диктофоны «плоскими» и ложно тянул их в сторону ИИ.
  const rmsValues = all;
  const rmsStdDb = rmsValues.length >= 2 ? popStd(rmsValues) : 0;
  const rmsDbMedian = percentile(all, 0.5);

  return {
    silenceFloorDb,
    zeroRunMs: zero.totalMs,
    longestZeroRunMs: zero.longestMs,
    cutoffHz: rate >= 40000 ? spectralCutoff(s, rate) : null,
    rmsStdDb,
    stationaryCv: highBandStationarity(s),
    rmsDbMedian,
    quietWindowCount: all.filter(d => d <= -52).length,
    activeWindowCount: active.length,
  };
}

/** Полный анализ аудио → список признаков. */
export function analyzeAudio(input: AudioInput): Indicator[] {
  const out: Indicator[] = [];
  const m = computeAudioMetrics(input);

  // 1. Ключевые слова в контейнере (ID3/Vorbis: software).
  if (input.fileStrings) {
    const ai = findKeywords(input.fileStrings, AI_KEYWORDS);
    if (ai.length > 0) {
      out.push({
        id: 'audio_software_ai',
        category: 'metadata',
        side: 'ai',
        weight: 52,
        title: 'Теги указывают на ИИ-генератор аудио',
        detail:
          'В ID3/Vorbis-тегах найдено имя нейросетевого сервиса. Такие подписи ставят ' +
          'сами генераторы музыки и голоса при экспорте файла.',
        evidence: ai.map(a => a.label).slice(0, 5).join(', '),
      });
    }
    const ffmpeg = FFMPEG_MARKERS.filter(f => input.fileStrings!.toLowerCase().includes(f));
    const human = findKeywords(input.fileStrings, HUMAN_KEYWORDS);
    if (ffmpeg.length > 0 && ai.length === 0) {
      out.push({
        id: 'audio_ffmpeg_container',
        category: 'container',
        side: 'ai',
        weight: 8,
        title: 'Контейнер перезаписан через FFmpeg',
        detail:
          'Подпись libav/Lavf означает программную пересборку файла. Так собирают ' +
          'пайплайны генерации аудио; обычные диктофоны и плееры её не ставят.',
        evidence: `найдено: ${ffmpeg.slice(0, 3).join(', ')}`,
      });
    }
    if (human.length > 0 && ai.length === 0) {
      out.push({
        id: 'audio_human_marker',
        category: 'metadata',
        side: 'human',
        weight: -8,
        title: 'В файлах найдены маркеры обычной записи',
        detail: 'Теги содержат привычные для бытовых записывающих устройств подписи.',
        evidence: human.map(h => h.label).slice(0, 4).join(', '),
      });
    }
  }

  const isLossy = input.isLossy === true;

  // 2. Цифровая тишина вместо шумового фона.
  if (m.longestZeroRunMs >= 120 && m.zeroRunMs >= 300) {
    out.push({
      id: 'audio_digital_silence',
      category: 'audio',
      side: 'ai',
      weight: isLossy ? 4 : 9,
      title: 'Участки абсолютной цифровой тишины',
      detail:
        'В «тихих» местах сэмплы равны ровно нулю. Живая запись почти всегда несёт ' +
        'шумовой фон (дыхание, зал, шум электроники); вырезание в чистый ноль — ' +
        'типичный след синтеза или жёсткой пороговой обработки.',
      evidence: `тишина без шума: ${m.zeroRunMs.toFixed(0)} мс подряд (макс ${m.longestZeroRunMs.toFixed(0)} мс)`,
    });
  }

  // 3. Шумовой фон.
  if (m.silenceFloorDb <= -88) {
    out.push({
      id: 'audio_floor_ultra_low',
      category: 'audio',
      side: isLossy ? 'neutral' : 'ai',
      weight: isLossy ? 0 : 10,
      title: 'Шумовой фон ниже −88 dBFS',
      detail:
        'В паузах уровень падает глубже типичного порога АЦП: ни шума комнаты, ' +
        'ни самошума электроники. Так бывает у цифрового синтеза и у «стерильных» ' +
        'нейро-записей; микрофон обычно поднимает пол до −75…−60 dBFS.',
      evidence: `пол тишины = ${m.silenceFloorDb.toFixed(1)} dBFS`,
    });
  } else if (m.silenceFloorDb >= -74 && m.silenceFloorDb <= -45) {
    out.push({
      id: 'audio_floor_natural',
      category: 'audio',
      side: 'human',
      weight: -20,
      title: 'Слышимый естественный шумовой фон',
      detail:
        'В паузах сохраняется реальный фон записи (зал/комната/шум техники) — ' +
        'признак живой звукозаписи, а не синтеза «в пустоте».',
      evidence: `пол тишины = ${m.silenceFloorDb.toFixed(1)} dBFS`,
    });
  }

  // 3b. Естественные паузы: тихие места есть, но их не вырезали в ноль.
  if (
    m.quietWindowCount >= 2 &&
    m.activeWindowCount >= 3 &&
    m.longestZeroRunMs < 120
  ) {
    out.push({
      id: 'audio_natural_pauses',
      category: 'audio',
      side: 'human',
      weight: -10,
      title: 'Естественные паузы с остаточным шумом',
      detail:
        'В тихих местах уровень падает, но сэмплы не обнуляются: остаётся ' +
        'шумовой фон микшера/зал. Вырезание пауз в идеальный ноль — след ' +
        'цифровой сборки, а живая запись физически не может уйти в ноль.',
      evidence: `тихих окон: ${m.quietWindowCount}, самое длинное «не-ноль» затишье < 120 мс`,
    });
  }

  // 4. Резкий обрез спектра.
  if (m.cutoffHz !== null && m.cutoffHz > 0) {
    if (!isLossy && m.cutoffHz <= 17200) {
      out.push({
        id: 'audio_brickwall_lossless',
        category: 'spectrum',
        side: 'ai',
        weight: 16,
        title: 'Жёсткий обрез спектра в lossless-файле',
        detail:
          'Формат заявляет полный диапазон, но выше найденной частоты энергия обрывается ' +
          'практически мгновенно. Такой «стеновый» срез на уровне 15–17 кГц оставляют ' +
          'нейро-вокодеры (HiFi-GAN и аналоги) и предварительный синтез.',
        evidence: `обрез на ~${(m.cutoffHz / 1000).toFixed(1)} кГц при ${input.sampleRate} Гц`,
      });
    } else if (!isLossy && m.cutoffHz >= 19500) {
      out.push({
        id: 'audio_fullband',
        category: 'spectrum',
        side: 'human',
        weight: -6,
        title: 'Полный частотный диапазон записи',
        detail:
          'Энергия доходит почти до Найквиста без резкой стены — так звучит ' +
          'настоящая запись с микрофона или качественный рип.',
        evidence: `верх тона ≈ ${(m.cutoffHz / 1000).toFixed(1)} кГц`,
      });
    }
  }

  // 5. Микродинамика.
  if (m.rmsStdDb >= 0 && activeDynamicsAvailable(input)) {
    if (m.rmsStdDb < 1.8) {
      out.push({
        id: 'audio_dynamics_flat',
        category: 'audio',
        side: 'ai',
        weight: 7,
        title: 'Аномально ровная энергия на всей длительности',
        detail:
          'Громкость практически не меняется от окна к окну. Живые исполнения и речь ' +
          'имеют заметные микровсплески; предельно плоская огибающая характерна ' +
          'для компактных генеративных моделей и жёсткого лимитера.',
        evidence: `отклонение громкости = ${m.rmsStdDb.toFixed(2)} дБ`,
      });
    } else if (m.rmsStdDb <= 7.5) {
      out.push({
        id: 'audio_dynamics_natural',
        category: 'audio',
        side: 'human',
        weight: -7,
        title: 'Обычный диапазон динамики',
        detail:
          'Громкость меняется от фрагмента к фрагменту в диапазоне, характерном ' +
          'для живых записей и студийных сведений: без искусственной ровности ' +
          'и без чрезмерной стерильности.',
        evidence: `отклонение громкости = ${m.rmsStdDb.toFixed(2)} дБ`,
      });
    } else {
      out.push({
        id: 'audio_dynamics_live',
        category: 'audio',
        side: 'human',
        weight: -8,
        title: 'Выраженная динамика записи',
        detail:
          'Сильные перепады уровня между фрагментами — признак живого исполнения ' +
          'или речи с паузами.',
        evidence: `отклонение громкости = ${m.rmsStdDb.toFixed(2)} дБ`,
      });
    }
  }

  // 6. Стационарность ВЧ (шум вокодера) и её отсутствие у живого звука.
  if (m.stationaryCv >= 0 && m.stationaryCv < 0.05) {
    out.push({
      id: 'audio_stationary_hiss',
      category: 'spectrum',
      side: 'ai',
      weight: 7,
      title: 'ВЧ-компонент идеально стационарен',
      detail:
        'Энергия высоких полос практически не меняется во времени. У настоящего голоса ' +
        'и музыки «свист» всегда флуктуирует (дыхание, атаки, сибилянты), ' +
        'а нейро-вокодер генерирует равномерный шум.',
      evidence: `CV верхних полос = ${m.stationaryCv.toFixed(3)}`,
    });
  } else if (m.stationaryCv >= 0.15) {
    out.push({
      id: 'audio_stationary_lively',
      category: 'spectrum',
      side: 'human',
      weight: -6,
      title: 'ВЧ-полосы живо меняются во времени',
      detail:
        'Энергия высоких частот заметно флуктуирует от окна к окну — так ведёт себя ' +
        'естественный звук (атаки инструментов, дыхание, сибилянты), ' +
        'а не ровный шум синтезатора.',
      evidence: `CV верхних полос = ${m.stationaryCv.toFixed(3)}`,
    });
  }

  // 7. Структура стерео: псевдо-стерео в пользу ИИ, настоящее поле — в пользу человека.
  if (typeof input.stereoCorrelation === 'number' && input.channels === 2) {
    if (input.stereoCorrelation > 0.999) {
      out.push({
        id: 'audio_fake_stereo',
        category: 'audio',
        side: 'ai',
        weight: 5,
        title: 'Каналы идентичны (псевдо-стерео)',
        detail:
          'Левый и правый каналы совпадают попиксельно. Настоящая стереозапись ' +
          'всегда даёт разницу между каналами; монофайл, размноженный в стерео, ' +
          'характерен для экспортов генераторов.',
        evidence: `корреляция L/R = ${input.stereoCorrelation.toFixed(4)}`,
      });
    } else if (input.stereoCorrelation <= 0.98 && input.stereoCorrelation >= -0.9) {
      out.push({
        id: 'audio_true_stereo',
        category: 'audio',
        side: 'human',
        weight: -9,
        title: 'Настоящее стереополе',
        detail:
          'Каналы заметно отличаются друг от друга — такой разностью даёт ' +
          'реальную стереозапись (микрофоны, панорама, реверберация). ' +
          'У монофайла, скопированного в два канала, корреляция была бы ~1.',
        evidence: `корреляция L/R = ${input.stereoCorrelation.toFixed(4)}`,
      });
    }
  }

  // 8. Частота дискретизации 8/16 кГц — типична для синтеза речи.
  const origRate = input.originalSampleRate ?? input.sampleRate;
  if (origRate <= 16000) {
    out.push({
      id: 'audio_low_rate',
      category: 'audio',
      side: 'ai',
      weight: 8,
      title: 'Низкая исходная частота дискретизации',
      detail:
        'Частота 8/16 кГц характерна для каналов связи и синтезаторов речи. ' +
        'Современные записывающие устройства пишут от 44.1 кГц. ' +
        'Оговорка: так иногда архивируют старые диктофоны.',
      evidence: `${origRate} Гц`,
    });
  }

  // 9. «Круглая» длительность генератора.
  if (input.durationMs) {
    const sec = input.durationMs / 1000;
    const targets = [10, 15, 20, 30, 60];
    if (targets.some(t => Math.abs(sec - t) <= 0.08)) {
      out.push({
        id: 'audio_round_duration',
        category: 'container',
        side: 'ai',
        weight: 4,
        title: 'Длительность ровно как у выдачи генератора',
        detail:
          'Файл имеет «пакетную» длину (10/15/20/30/60 c) с точностью до 80 мс — ' +
          'так выдают результаты нейросервисы. У живых записей такая точность редка.',
        evidence: `${sec.toFixed(3)} c`,
      });
    }
  }

  return out;
}

function activeDynamicsAvailable(input: AudioInput): boolean {
  return input.samples.length >= input.sampleRate * 2;
}
