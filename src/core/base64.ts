/** Чистый декодер base64 → Uint8Array (работает и в Hermes, где нет atob/Buffer). */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP: Int16Array = (() => {
  const t = new Int16Array(128).fill(-1);
  for (let i = 0; i < ALPHABET.length; i++) {
    t[ALPHABET.charCodeAt(i)] = i;
  }
  return t;
})();

export function base64ToBytes(b64: string): Uint8Array {
  let clean = b64;
  const eq = clean.indexOf('=');
  if (eq >= 0) {
    clean = clean.slice(0, eq);
  }
  // Отбрасываем пробелы/переносы
  if (/[^A-Za-z0-9+/]/.test(clean)) {
    clean = clean.replace(/[^A-Za-z0-9+/]/g, '');
  }
  const outLen = Math.floor((clean.length * 3) / 4);
  const out = new Uint8Array(outLen);
  let outIdx = 0;
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    const v = code < 128 ? LOOKUP[code] : -1;
    if (v === undefined || v < 0) { continue; }
    buffer = (buffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[outIdx++] = (buffer >> bits) & 0xff;
    }
  }
  return outIdx === outLen ? out : out.subarray(0, outIdx);
}

/** Декодирует base64 в ASCII-строку (для поиска маркеров в начале файла). */
export function base64ToAscii(b64: string): string {
  const bytes = base64ToBytes(b64);
  // Чанками, чтобы не переполнить стек spread-ом
  let s = '';
  const CH = 4096;
  for (let i = 0; i < bytes.length; i += CH) {
    s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CH)) as unknown as number[]);
  }
  return s;
}
