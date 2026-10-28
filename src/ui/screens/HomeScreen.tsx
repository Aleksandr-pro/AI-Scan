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
  IconArrowRight,
  IconClock,
  IconInfo,
  IconPhoto,
  IconPulse,
  IconShield,
  IconPhone,
  IconUpload,
  IconVideo,
  IconAudio,
  VerdictIcon,
} from '../components/Icon';

interface Props {
  history: AnalysisResult[];
  onPick: (kind: MediaKind | 'any') => void;
  onOpenResult: (r: AnalysisResult) => void;
  onOpenHistory: () => void;
  onOpenAbout: () => void;
}

const KINDS: Array<{ kind: MediaKind; title: string; sub: string; Icon: typeof IconPhoto }> = [
  { kind: 'photo', title: 'Фото', sub: 'JPG · PNG · WebP · HEIC', Icon: IconPhoto },
  { kind: 'video', title: 'Видео', sub: 'MP4 · MOV · MKV · WebM', Icon: IconVideo },
  { kind: 'audio', title: 'Аудио', sub: 'WAV · MP3 · M4A · FLAC', Icon: IconAudio },
];

const VERDICT_TAG: Record<AnalysisResult['verdict'], string> = {
  AI: 'ИИ',
  HUMAN: 'ЧЕЛ',
  MIXED: 'СМЕШ',
  UNCERTAIN: '?',
};

export function HomeScreen({ history, onPick, onOpenResult, onOpenHistory, onOpenAbout }: Props) {
  const [kind, setKind] = useState<MediaKind>('photo');
  const recent = history.slice(0, 3);
  const selected = KINDS.find(k => k.kind === kind) ?? KINDS[0];

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.logo}>
          AI <Text style={styles.logoAccent}>SCAN</Text>
        </Text>
        <Text style={styles.tagline}>Детектор ИИ-контента: фото · видео · аудио</Text>
      </View>

      {/* Единая зона загрузки: сегменты + центральное действие */}
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
          <View style={styles.dropzoneIcon}>
            <IconUpload size={26} color={colors.accent} strokeWidth={1.6} />
          </View>
          <Text style={styles.dropzoneTitle}>Выбрать файл</Text>
          <Text style={styles.dropzoneHint}>Нажмите, чтобы открыть проводник</Text>
        </Pressable>

        <Text style={styles.dropzoneFormats}>{selected.sub}</Text>
      </View>

      {/* Основное действие второго уровня */}
      <Pressable
        onPress={() => onPick('any')}
        style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
      >
        <Text style={styles.primaryBtnText}>Выбрать файл вручную</Text>
        <IconArrowRight size={17} color={colors.accent} strokeWidth={2} />
      </Pressable>

      {/* Второстепенные переходы — без рамок, только воздух */}
      <View style={styles.linksRow}>
        <Pressable onPress={onOpenAbout} style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
          <IconInfo size={16} color={colors.textDim} />
          <Text style={styles.linkText}>Как работает анализ</Text>
        </Pressable>
        <Pressable onPress={onOpenHistory} style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
          <IconClock size={16} color={colors.textDim} />
          <Text style={styles.linkText}>История проверок</Text>
        </Pressable>
      </View>

      {recent.length > 0 && (
        <View>
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
                  <VerdictIcon verdict={r.verdict} size={19} color={t.color} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.histName} numberOfLines={1}>
                      {r.tech.fileName}
                    </Text>
                    <Text style={styles.histMeta} numberOfLines={1}>
                      {fmtDate(r.createdAt)} · {fmtBytes(r.tech.fileSize)} · {r.confidence}%
                    </Text>
                  </View>
                  <Text style={[styles.histTag, { color: t.color }]}>
                    {VERDICT_TAG[r.verdict]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      <View style={styles.factsRow}>
        <View style={styles.fact}>
          <IconShield size={14} color={colors.textDim} />
          <Text style={styles.factText}>офлайн</Text>
        </View>
        <View style={styles.fact}>
          <IconPhone size={14} color={colors.textDim} />
          <Text style={styles.factText}>на устройстве</Text>
        </View>
        <View style={styles.fact}>
          <IconPulse size={14} color={colors.textDim} />
          <Text style={styles.factText}>эвристика + спектры</Text>
        </View>
      </View>

      <Text style={styles.disclaimer}>
        Приложение даёт вероятностную оценку и поясняет каждый признак. Это не судебная экспертиза:
        сильная обработка может запутать любую автоматическую проверку.
      </Text>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.l, paddingTop: spacing.xl },
  header: { marginBottom: spacing.xl, marginTop: spacing.s },
  logo: {
    color: colors.text,
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: 4,
  },
  logoAccent: { color: colors.accent },
  tagline: { color: colors.textDim, fontSize: 13, marginTop: 5, fontWeight: '400' },

  /* Зона загрузки — главный герой страницы */
  dropzone: {
    backgroundColor: colors.card,
    borderRadius: 22,
    paddingHorizontal: spacing.m,
    paddingTop: spacing.m,
    paddingBottom: spacing.l,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.bg,
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
    paddingVertical: 24,
    gap: 6,
  },
  dropzoneIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(34,211,238,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.38)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  dropzoneTitle: { color: '#F4F7FD', fontSize: 17, fontWeight: '800', marginTop: 4 },
  dropzoneHint: { color: colors.textFaint, fontSize: 12.5 },
  dropzoneFormats: {
    color: colors.textFaint,
    fontSize: 11.5,
    textAlign: 'center',
    letterSpacing: 0.4,
    fontFamily: 'monospace',
  },

  /* Основная кнопка — тонированный акцент: контраст без большой яркости */
  primaryBtn: {
    marginTop: spacing.m,
    backgroundColor: 'rgba(34,211,238,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.45)',
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: spacing.l,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: { color: colors.accent, fontSize: 15, fontWeight: '800' },

  /* Ссылки */
  linksRow: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.l,
    paddingLeft: 2,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 6,
  },
  linkText: { color: colors.textDim, fontSize: 13, fontWeight: '600' },

  /* Последние проверки — чистый лист */
  histList: { marginTop: 2 },
  histRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    paddingVertical: 13,
  },
  histRowLine: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  histName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  histMeta: { color: colors.textFaint, fontSize: 11.5, marginTop: 3 },
  histTag: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },

  /* Факты вместо пилюль */
  factsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.l,
    marginTop: spacing.xl,
  },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  factText: { color: colors.textFaint, fontSize: 11.5 },

  disclaimer: {
    color: colors.textFaint,
    fontSize: 12,
    lineHeight: 17,
    marginTop: spacing.l,
  },
  pressed: { opacity: 0.7 },
});
