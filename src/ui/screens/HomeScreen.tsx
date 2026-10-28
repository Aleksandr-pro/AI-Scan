import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AnalysisResult, MediaKind } from '../../core/types';
import { colors, spacing, verdictTheme } from '../theme';
import { fmtBytes, fmtDate } from '../format';
import { SectionTitle } from '../components/Card';
import {
  IconChevronRight,
  IconInfo,
  IconPhoto,
  IconPulse,
  IconShield,
  IconPhone,
  IconUpload,
  IconVideo,
  IconAudio,
} from '../components/Icon';

interface Props {
  history: AnalysisResult[];
  onPick: (kind: MediaKind | 'any') => void;
  onOpenResult: (r: AnalysisResult) => void;
  onOpenHistory: () => void;
  onOpenAbout: () => void;
}

const KINDS: Array<{ kind: MediaKind; title: string; Icon: typeof IconPhoto }> = [
  { kind: 'photo', title: 'Фото', Icon: IconPhoto },
  { kind: 'video', title: 'Видео', Icon: IconVideo },
  { kind: 'audio', title: 'Аудио', Icon: IconAudio },
];

/** Подпись справа: процент всегда с расшифровкой, для MIXED/UNCERTAIN — слова. */
function verdictTag(r: AnalysisResult): string {
  switch (r.verdict) {
    case 'AI':
      return `${r.confidence}% ИИ`;
    case 'HUMAN':
      return `${r.confidence}% ЧЕЛ`;
    case 'MIXED':
      return 'спорно';
    default:
      return 'Неясно';
  }
}

/** Мини-спектр зоны приёма — тема продукта вместо декоративного круга. */
const SPECTRUM = [6, 11, 19, 13, 25, 15, 29, 17, 23, 11, 27, 15, 9, 21, 13, 7, 17, 10, 14, 8];

export function HomeScreen({ history, onPick, onOpenResult, onOpenHistory, onOpenAbout }: Props) {
  const [kind, setKind] = useState<MediaKind>('photo');
  const recent = history.slice(0, 3);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.logo}>
          AI <Text style={styles.logoStrong}>SCAN</Text>
        </Text>
        <Text style={styles.tagline}>Детектор ИИ-контента: фото · видео · аудио</Text>
      </View>

      {/* Единая зона загрузки: пунктир на фоне страницы, без внешней карточки */}
      <View style={styles.dropzone}>
        <View style={styles.segment}>
          {KINDS.map(k => {
            const active = k.kind === kind;
            return (
              <Pressable
                key={k.kind}
                onPress={() => setKind(k.kind)}
                style={({ pressed }) => [
                  styles.segmentItem,
                  active && styles.segmentItemActive,
                  pressed && !active && styles.pressed,
                ]}
              >
                <k.Icon size={15} color={active ? colors.text : colors.textFaint} strokeWidth={1.6} />
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {k.title}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={() => onPick(kind)}
          style={({ pressed }) => [styles.dropzoneAction, pressed && styles.pressed]}
        >
          <IconUpload size={40} color={colors.accent} strokeWidth={1.5} />
          <Text style={styles.dropzoneTitle}>Выбрать файл</Text>
          <Text style={styles.dropzoneHint}>
            JPG · PNG · WebP · HEIC — нажмите, чтобы открыть проводник
          </Text>
          <View style={styles.spectrum} accessibilityElementsHidden>
            {SPECTRUM.map((h, i) => (
              <View
                key={i}
                style={[
                  styles.spectrumBar,
                  { height: h },
                  i % 4 === 0 ? styles.spectrumBarMuted : { opacity: i % 2 === 0 ? 0.9 : 0.55 },
                ]}
              />
            ))}
          </View>
        </Pressable>
      </View>

      {/* Единственный переход во «Как работает» — заметная строка-кнопка */}
      <Pressable
        onPress={onOpenAbout}
        style={({ pressed }) => [styles.aboutRow, pressed && styles.pressed]}
      >
        <IconInfo size={18} color={colors.accent} />
        <Text style={styles.aboutRowText}>Как работает анализ</Text>
        <View style={{ flex: 1 }} />
        <IconChevronRight size={18} color={colors.textDim} />
      </Pressable>

      {recent.length > 0 && (
        <Pressable onPress={onOpenHistory} style={({ pressed }) => [pressed && styles.pressed]}>
          <SectionTitle title="Последние проверки" hint="все →" />
          <View style={styles.histList}>
            {recent.map((r, idx) => {
              const t = verdictTheme[r.verdict];
              return (
                <Pressable
                  key={r.id}
                  onPress={() => onOpenResult(r)}
                  style={({ pressed }) => [
                    styles.histRow,
                    idx < recent.length - 1 && styles.histRowLine,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.histBar, { backgroundColor: t.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.histName} numberOfLines={1}>
                      {r.tech.fileName}
                    </Text>
                    <Text style={styles.histMeta} numberOfLines={1}>
                      {fmtDate(r.createdAt)} · {fmtBytes(r.tech.fileSize)}
                    </Text>
                  </View>
                  <Text style={[styles.histTag, { color: t.color }]}>{verdictTag(r)}</Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      )}

      {/* Ключевые преимущества — заметные значки */}
      <View style={styles.chipsRow}>
        <View style={styles.chip}>
          <IconShield size={15} color={colors.accent} />
          <Text style={styles.chipText}>офлайн</Text>
        </View>
        <View style={styles.chip}>
          <IconPhone size={15} color={colors.accent} />
          <Text style={styles.chipText}>на устройстве</Text>
        </View>
        <View style={styles.chip}>
          <IconPulse size={15} color={colors.accent} />
          <Text style={styles.chipText}>эвристика + спектры</Text>
        </View>
      </View>

      <Text style={styles.disclaimer}>
        Приложение даёт вероятностную оценку и поясняет каждый признак. Это не судебная экспертиза:
        сильная обработка может запутать любую автоматическую проверку.
      </Text>
      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.l, paddingTop: spacing.xl },
  header: { marginBottom: spacing.xl },
  logo: {
    color: colors.text,
    fontSize: 37,
    fontWeight: '400',
    letterSpacing: 1.5,
  },
  logoStrong: { fontWeight: '900', letterSpacing: 0.5 },
  tagline: { color: colors.textDim, fontSize: 13.5, marginTop: spacing.s, fontWeight: '400' },

  /* Зона загрузки: пунктир на фоне страницы */
  dropzone: {
    borderStyle: 'dashed',
    borderWidth: 1.5,
    borderColor: 'rgba(147,160,184,0.5)',
    borderRadius: 20,
    paddingHorizontal: spacing.l,
    paddingTop: spacing.l,
    paddingBottom: spacing.xl,
    marginBottom: spacing.l,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.bgElevated,
    borderRadius: 13,
    padding: 3,
    gap: 2,
  },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 11,
  },
  segmentItemActive: { backgroundColor: '#1E263A' },
  segmentText: { color: colors.textFaint, fontSize: 13, fontWeight: '600' },
  segmentTextActive: { color: colors.text, fontWeight: '700' },
  dropzoneAction: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    gap: 0,
  },
  dropzoneTitle: { color: '#F4F7FD', fontSize: 17, fontWeight: '800', marginTop: spacing.l },
  dropzoneHint: {
    color: colors.textDim,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: spacing.s,
    lineHeight: 18,
  },
  spectrum: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 30,
    marginTop: spacing.l,
  },
  spectrumBar: {
    width: 3.5,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  spectrumBarMuted: {
    backgroundColor: colors.cardBorder,
    opacity: 1,
  },

  /* «Как работает анализ» — заметная строка */
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.bgElevated,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: spacing.l,
  },
  aboutRowText: { color: colors.text, fontSize: 15.5, fontWeight: '700' },

  /* Последние проверки — строки с цветным индикатором слева */
  histList: { marginTop: 2 },
  histRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.l,
    paddingVertical: 14,
  },
  histRowLine: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  histBar: {
    width: 4,
    height: 32,
    borderRadius: 3,
  },
  histName: { color: colors.text, fontSize: 14.5, fontWeight: '700' },
  histMeta: { color: colors.textDim, fontSize: 13, marginTop: 3 },
  histTag: { fontSize: 13, fontWeight: '800', letterSpacing: 0.2 },

  /* Преимущества — заметные значки */
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.s,
    marginTop: spacing.xl,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.bgElevated,
    borderRadius: 11,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  chipText: { color: colors.text, fontSize: 12.5, fontWeight: '700' },

  disclaimer: {
    color: colors.textDim,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.l,
  },
  pressed: { opacity: 0.7 },
});
