/**
 * Разбор служебных полей аудиотегов (ID3v2, Vorbis KEY=value, свободные
 * строки кодировщика) из сырых ASCII-строк файла.
 *
 * Зачем: ИИ-ключевые слова («Google Veo», «Suno»…) разрешено искать ТОЛЬКО
 * в полях encoder/software/comment и показывать, в каком именно поле найдено.
 * Случайное совпадение в сырых байтах не должно давать признак «ИИ +52» —
 * это убивает доверие к приложению сильнее всего.
 */

export type TagRole =
  | 'artist'
  | 'title'
  | 'album'
  | 'encoder'
  | 'software'
  | 'comment'
  | 'other';

export interface TagField {
  /** Исходное имя поля: TPE1, TSSE, ENCODER, COMMENT… */
  name: string;
  role: TagRole;
  value: string;
}

export interface ParsedTags {
  fields: TagField[];
  artist?: string;
  title?: string;
  album?: string;
}

const AI_SAFE_ROLES: ReadonlySet<TagRole> = new Set(['encoder', 'software', 'comment']);

/** Поле допускает поиск ИИ-подписей (encoder/software/comment). */
export function isAiSearchable(field: TagField): boolean {
  return AI_SAFE_ROLES.has(field.role) && isPrintableAscii(field.value);
}

/**
 * Значение полностью печатаемо ASCII-символами — только такие значения
 * участвуют в поиске ключевых слов (генераторы пишут латиницей).
 * Кириллица/бинарный мусор → значение не проходит фильтр.
 */
function isPrintableAscii(v: string): boolean {
  if (v.length === 0 || v.length > 200) { return false; }
  for (let i = 0; i < v.length; i++) {
    const c = v.charCodeAt(i);
    if (c < 0x20 || c > 0x7e) { return false; }
  }
  return true;
}

function utf8Decode(bytes: string): string {
  let pct = '';
  for (let i = 0; i < bytes.length; i++) {
    pct += '%' + bytes.charCodeAt(i).toString(16).padStart(2, '0');
  }
  try {
    return decodeURIComponent(pct);
  } catch {
    return bytes.replace(/[^\u0020-\u007EЀ-ӿ]+/g, ' ').trim();
  }
}

function decodeText(enc: number, bytes: string): string {
  if (enc === 1 || enc === 2) {
    // UTF-16 (LE/BE, возможно с BOM).
    let i = 0;
    let le = enc === 1;
    if (enc === 1 && bytes.length >= 2) {
      const b0 = bytes.charCodeAt(0);
      const b1 = bytes.charCodeAt(1);
      if (b0 === 0xff && b1 === 0xfe) { le = true; i = 2; }
      if (b0 === 0xfe && b1 === 0xff) { le = false; i = 2; }
    }
    let out = '';
    for (; i + 1 < bytes.length; i += 2) {
      const c = le
        ? bytes.charCodeAt(i) | (bytes.charCodeAt(i + 1) << 8)
        : (bytes.charCodeAt(i) << 8) | bytes.charCodeAt(i + 1);
      if (c === 0) { break; }
      out += String.fromCharCode(c);
    }
    // UTF-16 может нести ASCII-текст — перекодируем в unicode-строку.
    return out.replace(/\0/g, '').trim();
  }
  const raw = bytes.replace(/\0/g, '');
  if (enc === 3) { return utf8Decode(raw); }
  // enc 0 — латиница; байты >127 могли прийти как utf8 — пробуем декодировать.
  if (/[\x80-\xFF]/.test(raw)) { return utf8Decode(raw); }
  return raw.trim();
}

const FRAME_ROLES: Record<string, TagRole> = {
  TPE1: 'artist',
  TOPE: 'artist',
  TIT2: 'title',
  TALB: 'album',
  TENC: 'encoder',
  TSSE: 'software',
  COMM: 'comment',
  TXXX: 'comment',
};

function roleForKey(key: string): TagRole | null {
  const k = key.toUpperCase().replace(/[ -]/g, '');
  switch (k) {
    case 'ARTIST':
    case 'TPE1':
    case 'TOPE':
    case 'AUTHOR':
    case 'INTERPRETER':
      return 'artist';
    case 'TITLE':
    case 'TIT2':
      return 'title';
    case 'ALBUM':
    case 'TALB':
      return 'album';
    case 'ENCODER':
    case 'ENCODEDBY':
    case 'TENC':
      return 'encoder';
    case 'SOFTWARE':
    case 'TOOL':
    case 'VENDOR':
    case 'ORGANIZATION':
    case 'TSSE':
      return 'software';
    case 'COMMENT':
    case 'DESCRIPTION':
    case 'COMM':
    case 'TXXX':
      return 'comment';
    default:
      return null;
  }
}

/** Известные «ключевые» имена для свободного паттерна KEY= / KEY:. */
const KNOWN_KEYS =
  'ARTIST|ALBUMARTIST|ALBUM|TITLE|ENCODER|ENCODED[ -]?BY|ENCODEDBY|COMMENT|' +
  'DESCRIPTION|SOFTWARE|VENDOR|TOOL|ORGANIZATION|INTERPRETER|AUTHOR|' +
  'TPE1|TOPE|TIT2|TALB|TENC|TSSE|TXXX|COMM';

/** Разбирает ID3v2-заголовок в начале строки (байты сохранены как символы). */
function parseId3v2(s: string): TagField[] {
  if (s.length < 10 || s.slice(0, 3) !== 'ID3') { return []; }
  const verMajor = s.charCodeAt(3);
  const headFlags = s.charCodeAt(5);
  const cs = (p: number) =>
    ((s.charCodeAt(p) & 0x7f) << 21) |
    ((s.charCodeAt(p + 1) & 0x7f) << 14) |
    ((s.charCodeAt(p + 2) & 0x7f) << 7) |
    (s.charCodeAt(p + 3) & 0x7f);
  const tagSize = cs(6);
  let p = 10;
  if (headFlags & 0x40) {
    // Extended header: в v2.4 размер синхсейф, в v2.3 — обычный.
    const extSize = verMajor >= 4 ? cs(10) : s.charCodeAt(10) * 0x1000000 +
      (s.charCodeAt(11) << 16) + (s.charCodeAt(12) << 8) + s.charCodeAt(13);
    p = 10 + Math.max(0, extSize) + (verMajor >= 4 ? 0 : 4);
  }
  const end = Math.min(10 + tagSize, s.length);
  const out: TagField[] = [];
  while (p + 10 <= end) {
    const id = s.slice(p, p + 4);
    if (!/^[A-Z0-9]{4}$/.test(id)) { break; }
    let fs: number;
    if (verMajor >= 4) {
      fs = cs(p + 4);
    } else {
      fs =
        (s.charCodeAt(p + 4) << 24) >>> 0 |
        (s.charCodeAt(p + 5) << 16) |
        (s.charCodeAt(p + 6) << 8) |
        s.charCodeAt(p + 7);
      fs = ((s.charCodeAt(p + 4) << 24) +
        (s.charCodeAt(p + 5) << 16) +
        (s.charCodeAt(p + 6) << 8) +
        s.charCodeAt(p + 7)) >>> 0;
    }
    if (fs <= 0 || fs > 4_000_000 || p + 10 + fs > s.length + 64) { break; }
    const payload = s.slice(p + 10, p + 10 + fs);
    const role = FRAME_ROLES[id];
    if (role && payload.length >= 2) {
      const enc = payload.charCodeAt(0);
      let name = id;
      let value = '';
      if (id === 'COMM' || id === 'TXXX') {
        // enc(1) + lang(3, только COMM) + description + \0 + text.
        const body = id === 'COMM' ? payload.slice(4) : payload.slice(1);
        const text = decodeText(enc, body);
        const parts = text.split('\u0000').filter(x => x.length > 0);
        if (id === 'TXXX') {
          const desc = parts[0] || '';
          value = parts.slice(1).join(' ') || desc;
          const d = desc.toUpperCase();
          if (/ENCOD|SOFT|TOOL|VENDOR|GENERAT/.test(d)) {
            name = desc || 'TXXX';
          }
        } else {
          value = parts.length > 1 ? parts.slice(1).join(' ') : text;
        }
      } else {
        value = decodeText(enc, payload.slice(1));
      }
      value = value.trim().slice(0, 200);
      if (value.length > 0) {
        out.push({ name, role, value });
      }
    }
    p += 10 + fs;
  }
  return out;
}

/** Разбирает строки вида KEY=value / KEY: value / «encoded by X». */
function parseFreeFields(s: string): TagField[] {
  const out: TagField[] = [];

  // Известные ключи: граница — не-буква, разделитель — : = или управляющие.
  const keyRe = new RegExp(
    `(^|[^A-Za-z])(${KNOWN_KEYS})[\\x00-\\x20:=]+([^\\x00\\n]{1,200})`,
    'gi',
  );
  let m: RegExpExecArray | null;
  while ((m = keyRe.exec(s)) !== null) {
    const role = roleForKey(m[2]);
    if (!role) { continue; }
    let value = m[3].replace(/\s+/g, ' ').trim();
    // Обрезаем «хвост» из следующего поля (например, TIT2 после TENC).
    const nextKey = value.search(/[\x00][A-Z0-9]{4}[\x00]/);
    if (nextKey > 0) { value = value.slice(0, nextKey); }
    value = value.slice(0, 200);
    if (value.length >= 1) {
      const needsDecode = /[\x80-\xFF]/.test(value);
      if (needsDecode) { value = utf8Decode(value); }
      out.push({ name: m[2].toUpperCase(), role, value });
    }
    if (m.index + m[0].length === s.length) { break; }
  }

  // Любые KEY=value (например, com.android.version=14 mediarecorder aac).
  const genericRe = /(^|[^\w.])([A-Za-z][A-Za-z0-9_.-]{2,39})=([^\x00\n]{1,200})/g;
  while ((m = genericRe.exec(s)) !== null) {
    const key = m[2];
    if (new RegExp(`^(${KNOWN_KEYS})$`, 'i').test(key)) { continue; } // уже взято выше
    const role = roleForKey(key);
    if (!role) { continue; }
    let value = m[3].replace(/\s+/g, ' ').trim().slice(0, 200);
    if (/[\x80-\xFF]/.test(value)) { value = utf8Decode(value); }
    if (value.length >= 1) {
      out.push({ name: key, role, value });
    }
  }

  // «generated by X» / «created by X» / «produced by X» — строка кодировщика.
  const phraseRe = /\b((?:generated|created|produced|converted) by)\s*[:=]?\s*([^\x00\n]{1,160})/gi;
  while ((m = phraseRe.exec(s)) !== null) {
    let value = m[2].replace(/\s+/g, ' ').trim().slice(0, 160);
    if (/[\x80-\xFF]/.test(value)) { value = utf8Decode(value); }
    if (value.length >= 2) {
      out.push({ name: m[1].toLowerCase(), role: 'encoder', value });
    }
  }

  return out;
}

/**
 * Извлекает структурированные поля из сырых ASCII-строк файла.
 * Дубликаты (имя+значение) убираются; приоритет у корректного ID3v2-разбора.
 */
export function extractTagFields(ascii: string): ParsedTags {
  if (!ascii) { return { fields: [] }; }
  const id3 = parseId3v2(ascii);
  // Если ID3 разобран — свободные паттерны не гоняем по его бинарной части,
  // чтобы не насорить мусором; но KEY= (Vorbis) ищем всегда: он живёт в других
  // контейнерах и не пересекается с ID3-кадрами.
  const free = parseFreeFields(ascii);
  const seen = new Set<string>();
  const fields: TagField[] = [];
  for (const f of [...id3, ...free]) {
    const key = `${f.name}\u0000${f.value}`;
    if (seen.has(key)) { continue; }
    seen.add(key);
    fields.push(f);
  }
  const pick = (role: TagRole): string | undefined => {
    const v = fields.find(f => f.role === role && f.value.trim().length >= 1);
    return v ? v.value.trim() : undefined;
  };
  return {
    fields,
    artist: pick('artist'),
    title: pick('title'),
    album: pick('album'),
  };
}
