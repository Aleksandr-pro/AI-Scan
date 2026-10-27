import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { AnalysisResult } from '../../core/types';
import { colors, radius, spacing, verdictTheme } from '../theme';
import { fmtBytes, fmtDate, KIND_ICON } from '../format';

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
            <Text style={styles.emptyIcon}>🕰️</Text>
            <Text style={styles.emptyText}>
              Пока пусто.{'\n'}После первого анализа результат появится здесь.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const t = verdictTheme[item.verdict];
          return (
            <Pressable
              onPress={() => onOpen(item)}
              style={({ pressed }) => [
                styles.row,
                { borderColor: t.border },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.rowIcon}>{KIND_ICON[item.tech.mediaKind]}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName} numberOfLines={1}>{item.tech.fileName}</Text>
                <Text style={styles.rowMeta}>
                  {fmtDate(item.createdAt)} · {fmtBytes(item.tech.fileSize)}
                </Text>
                <Text style={[styles.rowVerdict, { color: t.color }]} numberOfLines={1}>
                  {t.icon} {item.verdictLabel} · {item.confidence}%
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
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
  back: { color: colors.accent, fontSize: 15, fontWeight: '700', width: 80 },
  title: { color: colors.text, fontSize: 17, fontWeight: '800' },
  clear: { color: colors.danger, fontSize: 13.5, fontWeight: '600', width: 80, textAlign: 'right' },
  list: { padding: spacing.l, paddingTop: spacing.s },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    backgroundColor: colors.card,
    borderRadius: radius.m,
    borderWidth: 1,
    padding: spacing.m,
    marginBottom: spacing.s,
  },
  rowIcon: { fontSize: 24 },
  rowName: { color: colors.text, fontSize: 14.5, fontWeight: '700' },
  rowMeta: { color: colors.textFaint, fontSize: 11.5, marginTop: 2 },
  rowVerdict: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  chevron: { color: colors.textFaint, fontSize: 24 },
  empty: { alignItems: 'center', marginTop: 80, gap: 10 },
  emptyIcon: { fontSize: 44 },
  emptyText: { color: colors.textFaint, fontSize: 14, textAlign: 'center', lineHeight: 21 },
});
