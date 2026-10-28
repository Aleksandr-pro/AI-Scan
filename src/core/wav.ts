/**
 * Мини-парсер WAV (RIFF/PCM и IEEE float).
 * Возвращает моно Int16-сэмплы и параметры потока.
 */

export interface WavData {
  samples: Int16Array;
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  isFloat: boolean;
  durationMs: number;
  stereoCorrelation?: number;
}

function readU32(d: Uint8Array, off: number): number {
  return (d[off] | (d[off + 1] << 8) | (d[off + 2] << 16) | (d[off + 3] << 24)) >>> 0;
}

function readU16(d: Uint8Array, off: number): number {
  return d[off] | (d[off + 1] << 8);
}

/** Ограничивает длительность (по числу сэмплов на канал), если нужно. */
function capSamples(samples: Int16Array, rate: number, maxSec: number): Int16Array {
  const max = Math.floor(rate * maxSec);
  return samples.length > max ? samples.subarray(0, max) : samples;
}

export function parseWav(bytes: Uint8Array, maxSeconds = 90): WavData {
  if (bytes.length < 44 || String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) !== 'RIFF') {
    throw new Error('Не RIFF/WAV файл');
  }
  let fmt: {
    audioFormat: number;
    channels: number;
    sampleRate: number;
    bitsPerSample: number;
  } | null = null;
  let dataOff = -1;
  let dataLen = 0;

  let off = 12;
  while (off + 8 <= bytes.length) {
    const id = String.fromCharCode(bytes[off], bytes[off + 1], bytes[off + 2], bytes[off + 3]);
    const size = readU32(bytes, off + 4);
    const body = off + 8;
    if (id === 'fmt ' && size >= 16) {
      fmt = {
        audioFormat: readU16(bytes, body),
        channels: readU16(bytes, body + 2),
        sampleRate: readU32(bytes, body + 4),
        bitsPerSample: readU16(bytes, body + 14),
      };
      if (fmt.audioFormat === 0xfffe && size >= 40) {
        // WAVE_FORMAT_EXTENSIBLE: реальный формат — первый 2 байта cbSize+2
        fmt.audioFormat = readU16(bytes, body + 24);
      }
    } else if (id === 'data') {
      dataOff = body;
      dataLen = Math.min(size, bytes.length - body);
      if (dataLen <= 0 && size === 0) {
        // streaming-вариант: данные до конца файла
        dataLen = bytes.length - body;
      }
    }
    if (id === 'data' && fmt) { break; }
    off = body + size + (size % 2);
    if (size <= 0) { break; }
  }

  if (!fmt || dataOff < 0) {
    throw new Error('WAV: не найдены fmt/data чанки');
  }
  const { channels, sampleRate, bitsPerSample } = fmt;
  if (channels < 1 || sampleRate < 1000) {
    throw new Error('WAV: некорректные параметры потока');
  }

  const isFloat = fmt.audioFormat === 3;
  const bytesPerSample = bitsPerSample / 8;
  const frameBytes = bytesPerSample * channels;
  const totalFrames = Math.floor(dataLen / frameBytes);
  const maxFrames = Math.floor(sampleRate * maxSeconds);
  const frames = Math.min(totalFrames, maxFrames);

  const out = new Int16Array(frames);
  let lSum = 0;
  let rSum = 0;
  let lrSum = 0;
  let llSum = 0;
  let rrSum = 0;
  let stereo = false;

  const view = new DataView(bytes.buffer, bytes.byteOffset + dataOff, frames * frameBytes);

  for (let f = 0; f < frames; f++) {
    const base = f * frameBytes;
    let l = 0;
    let r = 0;
    if (isFloat) {
      l = view.getFloat32(base, true);
      if (channels >= 2) { r = view.getFloat32(base + 4, true); }
      l = Math.max(-1, Math.min(1, l)) * 32767;
      r = Math.max(-1, Math.min(1, r)) * 32767;
    } else if (bitsPerSample === 16) {
      l = view.getInt16(base, true);
      if (channels >= 2) { r = view.getInt16(base + 2, true); }
    } else if (bitsPerSample === 8) {
      l = ((bytes[dataOff + base] - 128) << 8);
      if (channels >= 2) { r = ((bytes[dataOff + base + 1] - 128) << 8); }
    } else if (bitsPerSample === 24 || bitsPerSample === 32) {
      const readPcm = (o: number): number => {
        if (bitsPerSample === 24) {
          const v = bytes[dataOff + o] | (bytes[dataOff + o + 1] << 8) | (bytes[dataOff + o + 2] << 16);
          const s = v << 8 >> 8; // знак
          return s >> 8;
        }
        return view.getInt32(base + o, true) >> 16;
      };
      l = readPcm(0);
      if (channels >= 2) { r = readPcm(bytesPerSample); }
    } else {
      throw new Error(`WAV: неподдерживаемая разрядность ${bitsPerSample}`);
    }

    if (channels >= 2) {
      stereo = true;
      lSum += l;
      rSum += r;
      lrSum += l * r;
      llSum += l * l;
      rrSum += r * r;
      out[f] = Math.max(-32768, Math.min(32767, Math.round((l + r) / 2)));
    } else {
      out[f] = Math.max(-32768, Math.min(32767, Math.round(l)));
    }
  }

  let stereoCorrelation: number | undefined;
  if (stereo && frames > 100) {
    const n = frames;
    const cov = lrSum / n - (lSum / n) * (rSum / n);
    const vl = llSum / n - (lSum / n) * (lSum / n);
    const vr = rrSum / n - (rSum / n) * (rSum / n);
    if (vl > 0 && vr > 0) {
      stereoCorrelation = cov / Math.sqrt(vl * vr);
    }
  }

  return {
    samples: capSamples(out, sampleRate, maxSeconds),
    sampleRate,
    channels,
    bitsPerSample,
    isFloat,
    durationMs: (totalFrames / sampleRate) * 1000,
    stereoCorrelation,
  };
}
