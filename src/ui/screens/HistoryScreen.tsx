import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { AnalysisResult } from '../../core/types';
import { colors, spacing, verdictTheme } from '../theme';
import { fmtBytes, fmtDate } from '../format';
import { IconChevronRight, IconClock, KindIcon, VerdictIcon } from '../components/Icon';

interface Props {
  history: AnalysisResult[];
  onOpen: (r: AnalysisResult) => void;
  onClear: () => void;
  onBack: () => void;
}

export function HistoryScreen({ history, onOpen, onClear, onBack }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={styles.back}>‹ Назад</Text>
        </Pressable>
        <Text style={styles.title}>История проверок</Text>
        {history.length > 0 ? (
          <Pressable onPress={onClear} hitSlop={12}>
            <Text style={styles.clear}>Очистить</Text>
          </Pressable>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      <FlatList
        data={history}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <IconClock size={40} color={colors.textFaint} strokeWidth={1.3} />
            <Text style={styles.emptyText}>
              Пока пусто.{'\n'}После первого анализа результат появится здесь.
            </Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const t = verdictTheme[item.verdict];
          return (
            <Pressable
              onPress={() => onOpen(item)}
              style={({ pressed }) => [
                styles.row,
                index < history.length - 1 && styles.rowLine,
                pressed && { opacity: 0.7 },
              ]}
            >
              <KindIcon kind={item.tech.mediaKind} size={20} color={colors.textDim} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName} numberOfLines={1}>{item.tech.fileName}</Text>
                <Text style={styles.rowMeta}>
                  {fmtDate(item.createdAt)} · {fmtBytes(item.tech.fileSize)}
                </Text>
              </View>
              <View style={styles.rowRight}>
                <VerdictIcon verdict={item.verdict} size={16} color={t.color} />
                <Text style={[styles.rowVerdict, { color: t.color }]}>
                  {item.confidence}%
                </Text>
              </View>
              <IconChevronRight size={15} color={colors.textFaint} />
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.l,
    paddingTop: spacing.m,
    paddingBottom: spacing.s,
  },
  back: { color: colors.textDim, fontSize: 15, fontWeight: '600', width: 80 },
  title: { color: colors.text, fontSize: 17, fontWeight: '800' },
  clear: { color: colors.danger, fontSize: 13.5, fontWeight: '600', width: 80, textAlign: 'right' },
  list: { paddingHorizontal: spacing.l, paddingTop: spacing.s },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    paddingVertical: 14,
  },
  rowLine: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  rowName: { color: colors.text, fontSize: 14.5, fontWeight: '700' },
  rowMeta: { color: colors.textFaint, fontSize: 11.5, marginTop: 3 },
  rowRight: { alignItems: 'flex-end', gap: 3 },
  rowVerdict: { fontSize: 11, fontWeight: '800', fontVariant: ['tabular-nums'] },
  empty: { alignItems: 'center', marginTop: 80, gap: 14 },
  emptyText: { color: colors.textFaint, fontSize: 14, textAlign: 'center', lineHeight: 21 },
});
