import { analyzeAudio, AudioInput, spectralCutoff, zeroRunStats } from '../src/core/audioAnalysis';
import { parseWav } from '../src/core/wav';
import { base64ToBytes, base64ToAscii } from '../src/core/base64';
import { rng } from '../testUtils/synth';
import { fft } from '../src/core/fft';

function gauss(r: () => number): number {
  const u = Math.max(1e-9, r());
  const v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Шум с жёстким обрезом спектра через обратное БПФ. */
function bandLimitedNoise(rate: number, seconds: number, cutoffHz: number, amp: number, seed: number): Float64Array {
  let n = 1;
  while (n < rate * seconds) { n <<= 1; }
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  const r = rng(seed);
  const cutoffBin = Math.floor((cutoffHz / (rate / 2)) * (n / 2));
  for (let k = 1; k < cutoffBin; k++) {
    const phase = r() * 2 * Math.PI;
    const mag = (amp * n) / 4;
    re[k] += Math.cos(phase) * mag;
    im[k] += Math.sin(phase) * mag;
    re[n - k] += Math.cos(phase) * mag;
    im[n - k] -= Math.sin(phase) * mag;
  }
  fft(re, im, 1);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = re[i] / n;
  }
  // Нормировка, чтобы мультиколорантовый шум не клиппился.
  let max = 0;
  for (let i = 0; i < n; i++) { max = Math.max(max, Math.abs(out[i])); }
  if (max > 0) {
    const g = (amp * 3) / max;
    for (let i = 0; i < n; i++) { out[i] *= g; }
  }
  return out;
}

function toInt16(f: Float64Array, offset = 0, len = f.length): Int16Array {
  const out = new Int16Array(len);
  for (let i = 0; i < len; i++) {
    const v = Math.max(-1, Math.min(1, f[i + offset] ?? 0)) * 32767;
    out[i] = Math.round(v);
  }
  return out;
}

function hasId(list: { id: string }[], id: string): boolean {
  return list.some(i => i.id === id || i.id.endsWith(`_${id}`));
}

describe('base64', () => {
  test('декодирует известную строку', () => {
    const bytes = base64ToBytes('AAECAw==');
    expect(Array.from(bytes)).toEqual([0, 1, 2, 3]);
  });
  test('roundtrip через ASCII', () => {
    expect(base64ToAscii('SGVsbG8=')).toBe('Hello');
  });
  test('длинная строка без переносов', () => {
    const src = 'A'.repeat(3000);
    const b64 = Buffer.from(src, 'ascii').toString('base64');
    expect(base64ToAscii(b64)).toBe(src);
  });
});

describe('wav парсер', () => {
  function makeWav(samples: Int16Array, rate: number, channels: number): Uint8Array {
    const dataBytes = samples.length * 2;
    const buf = new Uint8Array(44 + dataBytes);
    const dv = new DataView(buf.buffer);
    const wr = (off: number, s: string) => {
      for (let i = 0; i < s.length; i++) { buf[off + i] = s.charCodeAt(i); }
    };
    wr(0, 'RIFF');
    dv.setUint32(4, 36 + dataBytes, true);
    wr(8, 'WAVE');
    wr(12, 'fmt ');
    dv.setUint32(16, 16, true);
    dv.setUint16(20, 1, true);
    dv.setUint16(22, channels, true);
    dv.setUint32(24, rate, true);
    dv.setUint32(28, rate * channels * 2, true);
    dv.setUint16(32, channels * 2, true);
    dv.setUint16(34, 16, true);
    wr(36, 'data');
    dv.setUint32(40, dataBytes, true);
    for (let i = 0; i < samples.length; i++) {
      dv.setInt16(44 + i * 2, samples[i], true);
    }
    return buf;
  }

  test('моно PCM16: сэмплы и параметры', () => {
    const rate = 44100;
    const s = new Int16Array(rate); // 1 секунда
    for (let i = 0; i < rate; i++) {
      s[i] = Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 10000);
    }
    const wav = makeWav(s, rate, 1);
    const parsed = parseWav(wav);
    expect(parsed.sampleRate).toBe(rate);
    expect(parsed.channels).toBe(1);
    expect(parsed.samples.length).toBe(rate);
    expect(parsed.durationMs).toBeCloseTo(1000, 0);
    expect(Math.abs(parsed.samples[100] - s[100])).toBeLessThanOrEqual(1);
  });

  test('стерео усредняется, корреляция близка к 1 для одинаковых каналов', () => {
    const rate = 8000;
    const mono = new Int16Array(800);
    for (let i = 0; i < mono.length; i++) {
      mono[i] = Math.round(Math.sin(i * 0.1) * 8000);
    }
    const stereo = new Int16Array(mono.length * 2);
    for (let i = 0; i < mono.length; i++) {
      stereo[i * 2] = mono[i];
      stereo[i * 2 + 1] = mono[i];
    }
    const parsed = parseWav(makeWav(stereo, rate, 2));
    expect(parsed.channels).toBe(2);
    expect(parsed.stereoCorrelation).toBeCloseTo(1, 3);
    expect(parsed.samples.length).toBe(mono.length);
  });

  test('обрезка до maxSeconds', () => {
    const rate = 44100;
    const s = new Int16Array(rate * 3);
    const parsed = parseWav(makeWav(s, rate, 1), 2);
    expect(parsed.samples.length).toBe(rate * 2);
  });
});

describe('zeroRunStats', () => {
  test('находит длинные интервалы цифровой тишины', () => {
    const rate = 44100;
    const s = new Int16Array(rate);
    for (let i = 0; i < rate; i++) {
      s[i] = i < 1000 ? 5000 : i > 5000 && i < 5000 + rate * 0.2 ? 0 : 3000;
    }
    const z = zeroRunStats(s, rate);
    expect(z.longestMs).toBeGreaterThan(150);
    expect(z.runs).toBeGreaterThanOrEqual(1);
  });
});

describe('spectralCutoff', () => {
  test('обрез на 16 кГц в сигнале с дискретизацией 44100', () => {
    const rate = 44100;
    const sig = bandLimitedNoise(rate, 2, 16000, 0.5, 42);
    const cut = spectralCutoff(toInt16(sig), rate);
    expect(cut).not.toBeNull();
    expect(cut!).toBeGreaterThan(15000);
    expect(cut!).toBeLessThan(17500);
  });

  test('полный диапазон → обреза нет около 16 кГц', () => {
    const rate = 44100;
    const sig = bandLimitedNoise(rate, 2, 21500, 0.5, 43);
    const cut = spectralCutoff(toInt16(sig), rate);
    // Верхняя граница подсчёта: отчётливо выше 17.5 кГц либо null (обрыва нет)
    expect(cut === null || cut > 18500).toBe(true);
  });
});

describe('analyzeAudio: синтетическая «живая запись»', () => {
  const rate = 44100;
  const seconds = 6;
  const r = rng(7);
  const sig = new Float64Array(rate * seconds);
  for (let i = 0; i < sig.length; i++) {
    // полный диапазон шума комнаты + «речь»
    const speech = i > rate * 1 && i < rate * 5 ? Math.sin(i * 0.017) * (0.4 + 0.3 * Math.sin(i * 0.00035)) : 0;
    const room = gauss(r) * 0.004; // пол ≈ −48 дБ
    sig[i] = speech + room;
  }
  const input: AudioInput = {
    samples: toInt16(sig),
    sampleRate: rate,
    originalSampleRate: rate,
    channels: 1,
    durationMs: seconds * 1000,
    isLossy: false,
    fileStrings: 'ID3 encoder: Audacity',
  };

  test('натуральный шумовой фон → признак человека', () => {
    const ind = analyzeAudio(input);
    expect(hasId(ind, 'audio_floor_natural')).toBe(true);
    expect(hasId(ind, 'audio_floor_ultra_low')).toBe(false);
  });

  test('нет цифровой тишины', () => {
    const ind = analyzeAudio(input);
    expect(hasId(ind, 'audio_digital_silence')).toBe(false);
  });

  test('полный спектр → признак полного диапазона', () => {
    const ind = analyzeAudio(input);
    expect(hasId(ind, 'audio_fullband')).toBe(true);
  });
});

describe('analyzeAudio: синтетическая «ИИ-генерация»', () => {
  const rate = 44100;
  // 30 c: блоки шума с обрезом 16 кГц, вставки идеальной тишины
  const noiseBlock = bandLimitedNoise(rate, 4, 16000, 0.35, 99);
  const total = rate * 30;
  const sig = new Float64Array(total);
  let pos = 0;
  let block = 0;
  while (pos < total) {
    const seg = Math.min(rate * 4, total - pos);
    if (block % 2 === 1) {
      // идеальная тишина
    } else {
      for (let i = 0; i < seg; i++) {
        sig[pos + i] = noiseBlock[(i + block * 1000) % noiseBlock.length];
      }
    }
    pos += seg;
    block++;
  }
  const input: AudioInput = {
    samples: toInt16(sig),
    sampleRate: rate,
    originalSampleRate: rate,
    channels: 1,
    durationMs: 30000,
    isLossy: false,
    fileStrings: 'XEB\x00 generated by Stable Audio',
  };

  const ind = analyzeAudio(input);

  test('жёсткий обрез спектра в lossless', () => {
    expect(hasId(ind, 'audio_brickwall_lossless')).toBe(true);
  });

  test('цифровая тишина и сверхнизкий фон', () => {
    expect(hasId(ind, 'audio_digital_silence')).toBe(true);
    expect(hasId(ind, 'audio_floor_ultra_low')).toBe(true);
  });

  test('тег генератора', () => {
    expect(hasId(ind, 'audio_software_ai')).toBe(true);
  });

  test('вердикт — AI', () => {
    const { scoreToResult } = require('../src/core/scoring');
    const result = scoreToResult({
      indicators: ind,
      tech: { fileName: 'track.wav', fileSize: 5_000_000, mediaKind: 'audio' },
      stages: [],
      warnings: [],
      id: 'a1',
    });
    expect(result.verdict).toBe('AI');
    expect(result.confidence).toBeGreaterThanOrEqual(70);
  });
});

describe('analyzeAudio: деградация без сэмплов', () => {
  test('без данных возвращаются только метаданные', () => {
    const ind = analyzeAudio({
      samples: new Int16Array(0),
      sampleRate: 44100,
      fileStrings: 'encoded by Suno',
      isLossy: true,
    });
    expect(ind.every(i => i.category === 'metadata' || i.category === 'container')).toBe(true);
    expect(hasId(ind, 'audio_software_ai')).toBe(true);
  });
});
