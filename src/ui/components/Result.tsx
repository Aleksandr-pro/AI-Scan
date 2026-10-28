import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Indicator } from '../../core/types';
import { colors, spacing, verdictTheme } from '../theme';
import { Chip } from './Card';
import { VerdictIcon } from './Icon';

/** Сила признака словами: пользователь не читает «+45» без объяснения. */
export function strengthLabel(w: number): string {
  const a = Math.abs(w);
  if (a >= 25) { return 'сильный'; }
  if (a >= 10) { return 'средний'; }
  return 'слабый';
}

/** Строка признака: чистый фон, воздух и тонкий разделитель. */
export function IndicatorItem({ item }: { item: Indicator }) {
  const tone =
    item.side === 'ai' ? colors.ai : item.side === 'human' ? colors.human : colors.neutral;
  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>{item.title}</Text>
        {item.weight !== 0 && (
          <View style={[styles.weightTag, { backgroundColor: tone + '16' }]}>
            <Text style={[styles.weight, { color: tone }]}>
              {strengthLabel(item.weight)}
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.detail}>{item.detail}</Text>
      {item.evidence ? (
        <Text style={styles.evidence}>Измерено: {item.evidence}</Text>
      ) : null}
    </View>
  );
}

/**
 * Герой вердикта: статус, уверенность и ОДНА шкала «человек ←→ ИИ»
 * с точкой на позиции балла. Никаких вторых полос и повтора списка
 * признаков — под шкалой только строка «на чём основан вывод».
 */
export function VerdictHero({
  verdict,
  label,
  confidence,
  score,
  basis,
}: {
  verdict: keyof typeof verdictTheme;
  label: string;
  confidence: number;
  score: number;
  basis: string;
}) {
  const t = verdictTheme[verdict];
  const conf = Math.max(0, Math.min(100, confidence));
  const dotPos = Math.max(0, Math.min(100, (score + 100) / 2));
  const dotColor = score > 5 ? colors.ai : score < -5 ? colors.human : t.color;
  return (
    <View style={styles.hero}>
      <View style={styles.heroTop}>
        <VerdictIcon verdict={verdict} size={22} color={t.color} />
        <Text style={[styles.heroLabel, { color: t.color }]} numberOfLines={2}>
          {label}
        </Text>
        <View style={styles.confBox}>
          <Text style={styles.confValue}>{conf}%</Text>
          <Text style={styles.confCaption}>уверенность</Text>
        </View>
      </View>

      <View style={styles.scaleRow}>
        <Text style={[styles.scaleEnd, { color: colors.human }]}>человек</Text>
        <Text style={styles.scaleEndRight}>ИИ</Text>
      </View>
      <View style={styles.scaleTrack}>
        <View style={styles.scaleDivider} />
        <View
          style={[
            styles.scaleDot,
            { left: `${dotPos}%` },
            { backgroundColor: dotColor },
          ]}
        />
      </View>

      <Text style={styles.basis}>Вывод: {basis}</Text>
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
  /* признак */
  wrap: {
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
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
  weightTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 7,
  },
  weight: {
    fontSize: 12,
    fontWeight: '700',
  },
  detail: {
    color: colors.textDim,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  evidence: {
    color: colors.textFaint,
    fontSize: 11.5,
    marginTop: 6,
    fontFamily: 'monospace',
  },

  /* герой вердикта */
  hero: {
    paddingTop: spacing.s,
    marginBottom: spacing.l,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
  },
  heroLabel: {
    flex: 1,
    fontSize: 15.5,
    fontWeight: '800',
    lineHeight: 20,
  },
  confBox: {
    alignItems: 'flex-end',
  },
  confValue: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  confCaption: {
    color: colors.textFaint,
    fontSize: 10.5,
    fontWeight: '400',
    marginTop: 1,
  },
  scaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.l,
  },
  scaleEnd: { fontSize: 12, fontWeight: '700' },
  scaleEndRight: { fontSize: 12, fontWeight: '700', color: colors.ai },
  scaleTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginTop: 8,
    justifyContent: 'center',
  },
  scaleDivider: {
    position: 'absolute',
    left: '50%',
    marginLeft: -0.5,
    width: 1,
    height: 10,
    top: -3,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  scaleDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: -5,
    top: -3,
    borderWidth: 2,
    borderColor: colors.bg,
  },
  basis: {
    color: colors.textDim,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.m,
  },
});
