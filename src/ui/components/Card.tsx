import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  accent?: string;
}

export function Card({ children, style, accent }: CardProps) {
  return (
    <View style={[styles.card, accent ? { borderLeftColor: accent, borderLeftWidth: 3 } : null, style]}>
      {children}
    </View>
  );
}

export function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={styles.sectionWrap}>
      <Text style={styles.section}>{title}</Text>
      {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
    </View>
  );
}

export function Chip({ label, color, filled }: { label: string; color: string; filled?: boolean }) {
  return (
    <View
      style={[
        styles.chip,
        { borderColor: color, backgroundColor: filled ? color + '22' : 'transparent' },
      ]}
    >
      <Text style={[styles.chipText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.l,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.l,
    marginBottom: spacing.m,
  },
  sectionWrap: {
    marginTop: spacing.xl,
    marginBottom: spacing.s,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  section: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  sectionHint: {
    color: colors.textFaint,
    fontSize: 12,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
