/**
 * Регрессионные тесты на смещение аудио-скоринга в сторону ИИ.
 *
 * Ложные срабатывания, которые были в v1.1.0:
 *  - «udio» (генератор Udio) матчился внутри «audiobook»/«audio»;
 *  - «descript» матчился внутри «description»;
 *  - у типовых скачанных MP3 не было человеческих признаков,
 *    из-за чего мелкие ИИ-намёки складывались в вердикт AI.
 */
import { analyzeAudio, AudioInput } from '../src/core/audioAnalysis';
import { AI_KEYWORDS, findKeywords, HUMAN_KEYWORDS } from '../src/core/keywords';
import { scoreToResult } from '../src/core/scoring';
import { AnalysisResult, Indicator } from '../src/core/types';
import { rng } from '../testUtils/synth';

function gauss(r: () => number): number {
  const u = Math.max(1e-9, r());
  const v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function verdictOf(ind: Indicator[]): AnalysisResult {
  return scoreToResult({
    indicators: ind,
    tech: { fileName: 'x.mp3', fileSize: 3_000_000, mediaKind: 'audio' },
    stages: [],
    warnings: [],
    id: 'bias-1',
  });
}

function hasId(list: { id: string }[], id: string): boolean {
  return list.some(i => i.id === id);
}

describe('findKeywords: границы токенов', () => {
  test('«audio»/«audiobook» не активируют маркер Udio', () => {
    expect(findKeywords('TIT2: My Book [audiobook] part 1', AI_KEYWORDS)).toHaveLength(0);
    expect(findKeywords('COMMENT: free audio download', AI_KEYWORDS)).toHaveLength(0);
    expect(findKeywords('AUDIO EDITOR', AI_KEYWORDS)).toHaveLength(0);
  });

  test('«description» не активирует маркер Descript', () => {
    expect(findKeywords('TXXX: description of the track', AI_KEYWORDS)).toHaveLength(0);
  });

  test('«pineapple» не активирует human-маркер Apple', () => {
    expect(findKeywords('pineapple smoothie', HUMAN_KEYWORDS)).toHaveLength(0);
    expect(findKeywords('recorded on iPhone', HUMAN_KEYWORDS).length).toBeGreaterThan(0);
  });

  test('стоячие имена генераторов по-прежнему находятся', () => {
    expect(findKeywords('encoded by Suno', AI_KEYWORDS).map(f => f.k)).toContain('suno');
    expect(findKeywords('Udio export v2', AI_KEYWORDS).map(f => f.k)).toContain('udio');
    expect(findKeywords('Stable Audio Online', AI_KEYWORDS).map(f => f.k)).toContain('stable audio');
    expect(findKeywords('omx.h264 encoder', HUMAN_KEYWORDS).map(f => f.k)).toContain('omx.');
  });
});

describe('типовый скачанный MP3 (конвертер, «audio» в теге)', () => {
  const rate = 44100;
  const seconds = 30;
  const r = rng(11);
  const sig = new Float64Array(rate * seconds);
  for (let i = 0; i < sig.length; i++) {
    const t = i / rate;
    const sec = Math.floor(t);
    // музыкальная «смесь»: аккорд + медленная трель + шум помещения
    const music =
      Math.sin(2 * Math.PI * 220 * t) * 0.25 +
      Math.sin(2 * Math.PI * 330 * t) * (0.15 + 0.1 * Math.sin(2 * Math.PI * 0.5 * t)) +
      Math.sin(2 * Math.PI * 440 * t) * 0.1 +
      gauss(r) * 0.01;
    // три «цифровые» паузы по 160 мс (типично после конвертации)
    const gap = sec % 7 === 3 && t - sec > 0.4 && t - sec < 0.56;
    sig[i] = gap ? 0 : music * (sec % 5 === 0 ? 1 : 0.8);
  }
  const samples = new Int16Array(sig.length);
  for (let i = 0; i < sig.length; i++) {
    samples[i] = Math.max(-32767, Math.min(32767, Math.round(sig[i] * 32767)));
  }

  const input: AudioInput = {
    samples,
    sampleRate: rate,
    originalSampleRate: rate,
    channels: 2,
    stereoCorrelation: 0.9996, // как у моно-файла, размноженного в стерео
    durationMs: 213_700,
    isLossy: true,
    fileStrings: 'TSSE\x00Lavf59.16.100\x00TIT2\x00Сказка - audio mix',
  };

  test('слово «audio» в теге не даёт признак ИИ-генератора', () => {
    const ind = analyzeAudio(input);
    expect(hasId(ind, 'audio_software_ai')).toBe(false);
  });

  test('вердикт не AI', () => {
    const res = verdictOf(analyzeAudio(input));
    expect(res.verdict).not.toBe('AI');
  });
});

describe('голосовая заметка с тегами устройства', () => {
  const rate = 44100;
  const seconds = 20;
  const r = rng(23);
  const sig = new Float64Array(rate * seconds);
  for (let i = 0; i < sig.length; i++) {
    const t = i / rate;
    const sec = Math.floor(t);
    const inBurst = sec % 4 < 2 && t - sec < 1.6;
    // естественный шум комнаты ≈ −60 дБ не обнуляется даже в паузах
    const room = gauss(r) * 0.001;
    const voice = inBurst
      ? Math.sin(2 * Math.PI * 180 * t) * (0.3 + 0.35 * Math.sin(2 * Math.PI * 3.1 * t)) +
        gauss(r) * 0.02
      : 0;
    sig[i] = voice + room;
  }
  const samples = new Int16Array(sig.length);
  for (let i = 0; i < sig.length; i++) {
    samples[i] = Math.max(-32767, Math.min(32767, Math.round(sig[i] * 32767)));
  }

  const input: AudioInput = {
    samples,
    sampleRate: rate,
    originalSampleRate: rate,
    channels: 1,
    durationMs: 19_873, // не «пакетная» длительность — не совпадает с 10/15/20/30/60 с
    isLossy: true,
    fileStrings: 'com.android.version=14 mediarecorder aac',
  };

  test('собирается в вердикт HUMAN', () => {
    const res = verdictOf(analyzeAudio(input));
    expect(res.verdict).toBe('HUMAN');
  });

  test('в отчёте есть объяснения человека', () => {
    const ind = analyzeAudio(input);
    const human = ind.filter(i => i.side === 'human');
    expect(human.length).toBeGreaterThanOrEqual(3);
    expect(hasId(ind, 'audio_floor_natural')).toBe(true);
    expect(hasId(ind, 'audio_natural_pauses')).toBe(true);
  });
});

describe('файл с явной подписью генератора', () => {
  test('тег Suno сам по себе даёт вердикт AI', () => {
    const rate = 44100;
    const samples = new Int16Array(rate * 3);
    const r = rng(5);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.round(gauss(r) * 4000);
    }
    const ind = analyzeAudio({
      samples,
      sampleRate: rate,
      originalSampleRate: rate,
      channels: 1,
      durationMs: 3000,
      isLossy: true,
      fileStrings: 'TENC: LAME3.100\nencoded by Suno AI',
    });
    expect(hasId(ind, 'audio_software_ai')).toBe(true);
    const ai = ind.find(i => i.id === 'audio_software_ai');
    expect(ai!.weight).toBeGreaterThanOrEqual(51);
    expect(verdictOf(ind).verdict).toBe('AI');
  });
});
