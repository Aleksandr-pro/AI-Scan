/**
 * Регрессия на главный падер доверия v1.2.x:
 * «Google Veo» в сырых байтах MP3 давал признак «ИИ +52».
 * Правило v1.3: ИИ-ключевые слова ищутся ТОЛЬКО в полях
 * encoder/software/comment, и всегда с указанием поля.
 */
import { analyzeAudio, AudioInput } from '../src/core/audioAnalysis';
import { extractTagFields, isAiSearchable } from '../src/core/tags';
import { AI_KEYWORDS, findKeywords } from '../src/core/keywords';
import { scoreToResult } from '../src/core/scoring';

function hasId(list: { id: string }[], id: string): boolean {
  return list.some(i => i.id === id);
}

const emptyAudio = (fileStrings?: string): AudioInput => ({
  samples: new Int16Array(0),
  sampleRate: 44100,
  fileStrings,
  isLossy: true,
});

describe('tags: ИИ-поиск только в служебных полях', () => {
  test('«Google Veo» в сырой строке файла без структуры поля — не признак ИИ', () => {
    // Строка вне тега: парсер не находит role encoder/software/comment → хита нет.
    const tags = extractTagFields('randombytes\x00\x91 Google Veo\x00junk');
    const aiFields = tags.fields.filter(f => isAiSearchable(f));
    const hits = aiFields.flatMap(f => findKeywords(f.value, AI_KEYWORDS));
    expect(hits).toHaveLength(0);
  });

  test('«Google Veo» в поле энкодера → ИИ-признак с указанием поля', () => {
    const tags = extractTagFields('TSSE\x00Google Veo Ultra\x00TIT2\x00My Song');
    const aiFields = tags.fields.filter(f => isAiSearchable(f));
    const hits = aiFields.flatMap(f => findKeywords(f.value, AI_KEYWORDS));
    expect(hits.length).toBeGreaterThan(0);

    const ind = analyzeAudio(emptyAudio('TSSE\x00Google Veo Ultra\x00'));
    expect(hasId(ind, 'audio_software_ai')).toBe(true);
    const found = ind.find(i => i.id === 'audio_software_ai')!;
    // Пользователь видит, ГДЕ найдено.
    expect(found.evidence ?? '').toContain('поле «');
    expect((found.evidence ?? '').toLowerCase()).toContain('veo');
  });

  test('«Google Veo» в title-поле (не encoder/software/comment) — без ИИ-признака', () => {
    const tags = extractTagFields('TIT2\x00Google Veo demo\x00');
    const aiFields = tags.fields.filter(f => isAiSearchable(f));
    expect(aiFields).toHaveLength(0);

    const ind = analyzeAudio(emptyAudio('TIT2\x00Google Veo demo\x00'));
    expect(hasId(ind, 'audio_software_ai')).toBe(false);
  });

  test('ID3v2-фрейм TENC с генератором → ИИ-признак', () => {
    const ind = analyzeAudio(emptyAudio('TENC\x00encoded by Suno'));
    expect(hasId(ind, 'audio_software_ai')).toBe(true);
  });

  test('бинарный мусор в значении не участвует в поиске', () => {
    const tags = extractTagFields('TSSE\x00Lavf\x02\x03 broken\x00');
    const aiFields = tags.fields.filter(f => isAiSearchable(f));
    expect(aiFields).toHaveLength(0);
  });
});

describe('tags: релизные поля (офлайн, без сети)', () => {
  test('исполнитель + название → сильный признак настоящей песни', () => {
    const ind = analyzeAudio(
      emptyAudio('TPE1\x00Queen\x00TIT2\x00Bohemian Rhapsody\x00TALB\x00A Night at the Opera'),
    );
    expect(hasId(ind, 'audio_release_tags')).toBe(true);
    const rel = ind.find(i => i.id === 'audio_release_tags')!;
    expect(rel.side).toBe('human');
    expect(rel.evidence ?? '').toContain('Queen');
    expect(rel.evidence ?? '').toContain('Bohemian Rhapsody');
  });

  test('только название → частичный признак (слабее)', () => {
    const ind = analyzeAudio(emptyAudio('TIT2\x00Some Track Title'));
    expect(hasId(ind, 'audio_release_tags')).toBe(false);
    expect(hasId(ind, 'audio_release_tags_partial')).toBe(true);
  });

  test('релизные теги + явный ИИ-энкодер → побеждает ИИ, release не добавляется', () => {
    const ind = analyzeAudio(
      emptyAudio('TPE1\x00Some Artist\x00TIT2\x00A Song\x00TSSE\x00encoded by Suno'),
    );
    expect(hasId(ind, 'audio_software_ai')).toBe(true);
    expect(hasId(ind, 'audio_release_tags')).toBe(false);
    expect(hasId(ind, 'audio_release_tags_partial')).toBe(false);
  });

  test('типовый MP3 с релизными тегами и Lavf-пересборкой → не AI-вердикт', () => {
    const ind = analyzeAudio(
      emptyAudio('TPE1\x00Various Artists\x00TIT2\x00Compilation Track\x00TSSE\x00Lavf59.16.100'),
    );
    const r = scoreToResult({
      indicators: ind,
      tech: { fileName: 'x.mp3', fileSize: 3_000_000, mediaKind: 'audio' },
      stages: [],
      warnings: [],
      id: 'tags-1',
    });
    expect(r.verdict).not.toBe('AI');
    expect(hasId(ind, 'audio_release_tags')).toBe(true);
    expect(hasId(ind, 'audio_ffmpeg_container')).toBe(true);
    expect(hasId(ind, 'audio_software_ai')).toBe(false);
  });
});
