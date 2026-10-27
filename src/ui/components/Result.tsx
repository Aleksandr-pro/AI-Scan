import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Indicator } from '../../core/types';
import { colors, radius, spacing, verdictTheme } from '../theme';
import { fmtWeight } from '../format';
import { Chip } from './Card';

/** Карточка одного признака с объяснением «почему». */
export function IndicatorItem({ item }: { item: Indicator }) {
  const accentColor =
    item.side === 'ai'
      ? colors.ai
      : item.side === 'human'
        ? colors.human
        : colors.neutral;
  const tone =
    item.side === 'ai' ? colors.ai : item.side === 'human' ? colors.human : colors.textDim;
  return (
    <View style={[styles.wrap, { borderLeftColor: accentColor }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{item.title}</Text>
        <View style={styles.weightBox}>
          <Text style={[styles.weight, { color: tone }]}>
            {item.weight === 0 ? '—' : fmtWeight(item.weight)}
          </Text>
        </View>
      </View>
      <Text style={styles.detail}>{item.detail}</Text>
      {item.evidence ? (
        <Text style={styles.evidence}>Измерено: {item.evidence}</Text>
      ) : null}
    </View>
  );
}

/** Полоса уверенности 0…100. */
export function ConfidenceBar({ value, color }: { value: number; color: string }) {
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${Math.max(2, Math.min(100, value))}%`, backgroundColor: color }]} />
      {Array.from({ length: 4 }).map((_, i) => (
        <View key={i} style={[styles.barTick, { left: `${(i + 1) * 20}%` }]} />
      ))}
    </View>
  );
}

/** Герой вердикта: иконка, название, уверенность. */
export function VerdictHero({
  verdict,
  label,
  confidence,
  summary,
}: {
  verdict: keyof typeof verdictTheme;
  label: string;
  confidence: number;
  summary: string;
}) {
  const t = verdictTheme[verdict];
  return (
    <View style={[styles.hero, { backgroundColor: t.bg, borderColor: t.border }]}>
      <View style={styles.heroTop}>
        <Text style={styles.heroIcon}>{t.icon}</Text>
        <View style={styles.heroTexts}>
          <Text style={[styles.heroLabel, { color: t.color }]}>{label}</Text>
          <Text style={styles.heroVerdict}>{verdict === 'AI' ? 'ИИ подозревается' : verdict === 'HUMAN' ? 'Следов ИИ не найдено' : verdict === 'MIXED' ? 'Человек + ИИ' : 'Данных мало'}</Text>
        </View>
        <View style={[styles.confBox, { borderColor: t.color }]}>
          <Text style={[styles.confValue, { color: t.color }]}>{confidence}%</Text>
          <Text style={styles.confCaption}>уверенность</Text>
        </View>
      </View>
      <ConfidenceBar value={confidence} color={t.color} />
      <Text style={styles.summary}>{summary}</Text>
    </View>
  );
}

export function CategoryChip({ category }: { category: string }) {
  const labels: Record<string, string> = {
    metadata: 'Метаданные',
    container: 'Контейнер',
    noise: 'Шум',
    spectrum: 'Спектр',
    structure: 'Структура',
    temporal: 'Кадры',
    audio: 'Аудио',
    dimensions: 'Размеры',
  };
  return <Chip label={labels[category] || category} color={colors.textFaint} />;
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.m,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.m,
    marginBottom: spacing.s,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.s,
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: 14.5,
    fontWeight: '700',
    lineHeight: 19,
  },
  weightBox: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  weight: {
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  detail: {
    color: colors.textDim,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  evidence: {
    color: colors.textFaint,
    fontSize: 12,
    marginTop: 6,
    fontFamily: 'monospace',
  },
  hero: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.l,
    marginBottom: spacing.m,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
  },
  heroIcon: {
    fontSize: 34,
  },
  heroTexts: {
    flex: 1,
  },
  heroLabel: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
  },
  heroVerdict: {
    color: colors.textDim,
    fontSize: 13,
    marginTop: 2,
  },
  confBox: {
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: radius.m,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 84,
  },
  confValue: {
    fontSize: 22,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  confCaption: {
    color: colors.textFaint,
    fontSize: 10,
    marginTop: -2,
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginTop: spacing.m,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  barFill: {
    height: 8,
    borderRadius: 4,
  },
  barTick: {
    position: 'absolute',
    width: 1,
    height: 8,
    backgroundColor: 'rgba(11,14,20,0.55)',
  },
  summary: {
    color: colors.textDim,
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: spacing.m,
  },
});
