import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AnalysisResult, MediaKind } from '../../core/types';
import { colors, radius, spacing, verdictTheme } from '../theme';
import { fmtBytes, fmtDate } from '../format';
import { Card, SectionTitle } from '../components/Card';

interface Props {
  history: AnalysisResult[];
  onPick: (kind: MediaKind | 'any') => void;
  onOpenResult: (r: AnalysisResult) => void;
  onOpenHistory: () => void;
  onOpenAbout: () => void;
}

const KINDS: Array<{ kind: MediaKind; title: string; sub: string; icon: string }> = [
  { kind: 'photo', title: 'Фото', sub: 'JPG · PNG · WebP · HEIC', icon: '🖼️' },
  { kind: 'video', title: 'Видео', sub: 'MP4 · MOV · MKV · WebM', icon: '🎬' },
  { kind: 'audio', title: 'Аудио', sub: 'WAV · MP3 · M4A · FLAC', icon: '🎵' },
];

export function HomeScreen({ history, onPick, onOpenResult, onOpenHistory, onOpenAbout }: Props) {
  const recent = history.slice(0, 3);
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.logo}>
          AI <Text style={styles.logoAccent}>SCAN</Text>
        </Text>
        <Text style={styles.tagline}>Детектор ИИ-контента: фото · видео · аудио</Text>
      </View>

      <Card>
        <Text style={styles.cardTitle}>Загрузите материал для проверки</Text>
        <Text style={styles.cardSub}>
          Файл анализируется прямо на устройстве: метаданные, статистика шума, спектры и признаки генерации.
        </Text>
        <View style={styles.kindRow}>
          {KINDS.map(k => (
            <Pressable
              key={k.kind}
              onPress={() => onPick(k.kind)}
              style={({ pressed }) => [styles.kindCard, pressed && styles.pressed]}
            >
              <Text style={styles.kindIcon}>{k.icon}</Text>
              <Text style={styles.kindTitle}>{k.title}</Text>
              <Text style={styles.kindSub}>{k.sub}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          onPress={() => onPick('any')}
          style={({ pressed }) => [styles.anyBtn, pressed && styles.pressed]}
        >
          <Text style={styles.anyBtnText}>Выбрать файл вручную →</Text>
        </Pressable>
      </Card>

      <View style={styles.linksRow}>
        <Pressable onPress={onOpenAbout} style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
          <Text style={styles.linkText}>🔬 Как работает анализ</Text>
        </Pressable>
        <Pressable onPress={onOpenHistory} style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
          <Text style={styles.linkText}>🕘 История проверок</Text>
        </Pressable>
      </View>

      {recent.length > 0 && (
        <View>
          <SectionTitle title="Последние проверки" hint="все →" />
          {recent.map(r => {
            const t = verdictTheme[r.verdict];
            return (
              <Pressable
                key={r.id}
                onPress={() => onOpenResult(r)}
                style={({ pressed }) => [styles.histRow, { borderColor: t.border }, pressed && styles.pressed]}
              >
                <Text style={styles.histIcon}>{t.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.histName} numberOfLines={1}>
                    {r.tech.fileName}
                  </Text>
                  <Text style={styles.histMeta} numberOfLines={1}>
                    {fmtDate(r.createdAt)} · {fmtBytes(r.tech.fileSize)} · уверенность {r.confidence}%
                  </Text>
                </View>
                <Text style={[styles.histVerdict, { color: t.color }]}>
                  {r.verdict === 'AI' ? 'ИИ' : r.verdict === 'HUMAN' ? 'ЧЕЛ' : r.verdict === 'MIXED' ? 'СМЕШ' : '?'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={styles.pillRow}>
        <View style={styles.pill}>
          <Text style={styles.pillText}>🔒 офлайн</Text>
        </View>
        <View style={styles.pill}>
          <Text style={styles.pillText}>📱 на устройстве</Text>
        </View>
        <View style={styles.pill}>
          <Text style={styles.pillText}>🧠 эвристика + спектры</Text>
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
  tagline: { color: colors.textDim, fontSize: 14, marginTop: 4 },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  cardSub: { color: colors.textDim, fontSize: 13, lineHeight: 19, marginTop: 6 },
  kindRow: { flexDirection: 'row', gap: spacing.s, marginTop: spacing.l },
  kindCard: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.l,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingVertical: spacing.m,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  kindIcon: { fontSize: 30 },
  kindTitle: { color: colors.text, fontWeight: '800', fontSize: 15, marginTop: 6 },
  kindSub: { color: colors.textFaint, fontSize: 9.5, marginTop: 3, textAlign: 'center' },
  pressed: { opacity: 0.65, transform: [{ scale: 0.985 }] },
  anyBtn: {
    marginTop: spacing.m,
    backgroundColor: colors.accent + '1A',
    borderRadius: radius.m,
    borderWidth: 1,
    borderColor: colors.accent + '66',
    paddingVertical: spacing.m,
    alignItems: 'center',
  },
  anyBtnText: { color: colors.accent, fontWeight: '700', fontSize: 14.5 },
  linksRow: { flexDirection: 'row', gap: spacing.s, marginTop: spacing.s },
  link: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.m,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingVertical: spacing.m,
    alignItems: 'center',
  },
  linkText: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  histRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    backgroundColor: colors.card,
    borderRadius: radius.m,
    borderWidth: 1,
    padding: spacing.m,
    marginBottom: spacing.s,
  },
  histIcon: { fontSize: 22 },
  histName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  histMeta: { color: colors.textFaint, fontSize: 11.5, marginTop: 2 },
  histVerdict: { fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  pillRow: { flexDirection: 'row', gap: spacing.s, marginTop: spacing.l, flexWrap: 'wrap' },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: colors.bgElevated,
  },
  pillText: { color: colors.textFaint, fontSize: 11.5 },
  disclaimer: {
    color: colors.textFaint,
    fontSize: 12,
    lineHeight: 17,
    marginTop: spacing.l,
  },
});
