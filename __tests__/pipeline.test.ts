import { detectKind, plainPathFromUri, safeDecodeName } from '../src/core/pipeline';

describe('plainPathFromUri', () => {
  test('file:// → обычный путь', () => {
    expect(plainPathFromUri('file:///data/user/0/com.aiscan/cache/abc/voice.mp3')).toBe(
      '/data/user/0/com.aiscan/cache/abc/voice.mp3',
    );
  });

  test('раскодирует URL-encoded имена', () => {
    expect(
      plainPathFromUri('file:///data/user/0/com.aiscan/cache/x/4%D1%87%D0%B0%D1%81%D1%82%D1%8C.mp3'),
    ).toBe('/data/user/0/com.aiscan/cache/x/4часть.mp3');
  });

  test('некорректный % не роняет разбор', () => {
    expect(plainPathFromUri('file:///a/50%_off.jpg')).toBe('/a/50%_off.jpg');
  });

  test('content:// не трогает (обрабатывается отдельно)', () => {
    expect(plainPathFromUri('content://media/external/file/42')).toBe(
      'content://media/external/file/42',
    );
  });

  test('обычный путь возвращается как есть', () => {
    expect(plainPathFromUri('/data/local/tmp/x.png')).toBe('/data/local/tmp/x.png');
  });
});

describe('safeDecodeName', () => {
  test('раскодирует', () => {
    expect(safeDecodeName('%D1%87.mp3')).toBe('ч.mp3');
  });
  test('битые последовательности не падают', () => {
    expect(safeDecodeName('100%_final.mp3')).toBe('100%_final.mp3');
  });
});

describe('detectKind', () => {
  test('по расширению', () => {
    expect(detectKind('/cache/a/b.jpg')).toBe('photo');
    expect(detectKind('/cache/a/b.MKV')).toBe('video');
    expect(detectKind('/cache/a/b.flac')).toBe('audio');
  });

  test('по MIME, если расширения нет', () => {
    expect(detectKind('/cache/picked_123/noext', 'audio/mpeg')).toBe('audio');
    expect(detectKind('/cache/picked_123/noext', 'video/mp4')).toBe('video');
    expect(detectKind('/cache/picked_123/noext', 'image/png')).toBe('photo');
  });

  test('query-строка в пути игнорируется', () => {
    expect(detectKind('/cache/x.mp3?alt=media')).toBe('audio');
  });

  test('расширение сильнее некорректного MIME', () => {
    expect(detectKind('/cache/photo.heic', 'application/octet-stream')).toBe('photo');
  });
});
