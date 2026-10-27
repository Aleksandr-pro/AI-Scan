import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AnalysisResult, EvidenceSide } from '../../core/types';
import { sidePowers } from '../../core/scoring';
import { buildReport } from '../../core/report';
import { colors, radius, spacing } from '../theme';
import { fmtBytes, fmtDate, fmtDuration, KIND_ICON, KIND_LABEL } from '../format';
import { Card, SectionTitle } from '../components/Card';
import { CategoryChip, IndicatorItem, VerdictHero } from '../components/Result';

interface Props {
  result: AnalysisResult;
  onScanAgain: () => void;
  onHome: () => void;
  onDelete?: () => void;
}

export function ResultScreen({ result, onScanAgain, onHome, onDelete }: Props) {
  const [shared, setShared] = useState(false);
  const powers = useMemo(() => sidePowers(result.indicators), [result.indicators]);

  const groups: Array<{ side: EvidenceSide; title: string }> = [
    { side: 'ai', title: 'Признаки создания/обработки ИИ' },
    { side: 'human', title: 'Признаки живой съёмки и записи' },
    { side: 'neutral', title: 'Информационные наблюдения' },
  ];

  const onShare = async () => {
    try {
      const text = buildReport(result);
      await Share.share({ message: text, title: 'AI Scan — отчёт' });
      setShared(true);
    } catch {
      // пользователь закрыл шаринг
    }
  };

  const tech: Array<[string, string]> = [];
  const t = result.tech;
  if (t.width && t.height) { tech.push(['Разрешение', `${t.width}×${t.height}`]); }
  if (t.durationMs) { tech.push(['Длительность', fmtDuration(t.durationMs)]); }
  if (t.sampleRate) { tech.push(['Частота дискретизации', `${t.sampleRate} Гц`]); }
  if (t.channels) { tech.push(['Каналы', String(t.channels)]); }
  if (t.bitrate) { tech.push(['Битрейт', `${Math.round(t.bitrate / 1000)} кбит/с`]); }
  if (t.frameRate) { tech.push(['Кадров/с', String(t.frameRate)]); }
  if (t.codec) { tech.push(['Кодек', t.codec]); }
  if (t.mimeType) { tech.push(['MIME', t.mimeType]); }
  tech.push(['Размер файла', fmtBytes(t.fileSize)]);
  tech.push(['Тип', KIND_LABEL[t.mediaKind]]);
  tech.push(['Проверен', fmtDate(result.createdAt)]);
  if (t.extra) {
    for (const [k, v] of Object.entries(t.extra)) {
      if (v !== undefined && v !== null && String(v).length > 0) {
        tech.push([k, String(v)]);
      }
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <VerdictHero
        verdict={result.verdict}
        label={result.verdictLabel}
        confidence={result.confidence}
        summary={result.summary}
      />

      <Card>
        <View style={styles.fileRow}>
          <Text style={styles.fileIcon}>{KIND_ICON[t.mediaKind]}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.fileName} numberOfLines={2}>{t.fileName}</Text>
            <Text style={styles.fileMeta}>
              {fmtBytes(t.fileSize)} · оценка {result.score >= 0 ? '+' : ''}{result.score} (±100)
            </Text>
          </View>
        </View>
        <View style={styles.powersRow}>
          <Text style={[styles.powerLabel, { color: colors.ai }]}>ИИ {powers.ai}</Text>
          <View style={styles.powersTrack}>
            <View
              style={[
                styles.powersAi,
                {
                  width: `${(powers.ai / Math.max(1, powers.ai + powers.human)) * 100}%`,
                },
              ]}
            />
          </View>
          <Text style={[styles.powerLabel, { color: colors.human }]}>чел. {powers.human}</Text>
        </View>
      </Card>

      <SectionTitle
        title="Признаки и почему они важны"
        hint={`${result.indicators.length} шт.`}
      />
      {groups.map(g => {
        const list = result.indicators
          .filter(i => i.side === g.side)
          .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
        if (list.length === 0) { return null; }
        const gColor =
          g.side === 'ai' ? colors.ai : g.side === 'human' ? colors.human : colors.neutral;
        return (
          <View key={g.side} style={styles.group}>
            <View style={styles.groupHead}>
              <View style={[styles.groupDot, { backgroundColor: gColor }]} />
              <Text style={[styles.groupTitle, { color: gColor }]}>{g.title}</Text>
            </View>
            {list.map(i => (
              <IndicatorItem key={i.id} item={i} />
            ))}
          </View>
        );
      })}

      <SectionTitle title="Технические данные" />
      <Card>
        <View style={styles.techGrid}>
          {tech.map(([k, v]) => (
            <View key={k} style={styles.techRow}>
              <Text style={styles.techKey}>{k}</Text>
              <Text style={styles.techVal} numberOfLines={2}>{v}</Text>
            </View>
          ))}
        </View>
        <View style={styles.chipWrap}>
          {Array.from(new Set(result.indicators.map(i => i.category))).map(c => (
            <CategoryChip key={c} category={c} />
          ))}
        </View>
      </Card>

      {result.warnings.length > 0 && (
        <Card accent={colors.mixed}>
          <Text style={styles.warnTitle}>Примечания анализа</Text>
          {result.warnings.map((w, idx) => (
            <Text key={idx} style={styles.warnText}>• {w}</Text>
          ))}
        </Card>
      )}

      <View style={styles.actions}>
        <Pressable onPress={onShare} style={({ pressed }) => [styles.btnPrimary, pressed && styles.pressed]}>
          <Text style={styles.btnPrimaryText}>{shared ? '✓ Отчёт отправлен' : '📤 Поделиться отчётом'}</Text>
        </Pressable>
        <View style={styles.actionsRow}>
          <Pressable onPress={onScanAgain} style={({ pressed }) => [styles.btnGhost, pressed && styles.pressed]}>
            <Text style={styles.btnGhostText}>🔄 Сканировать ещё</Text>
          </Pressable>
          <Pressable onPress={onHome} style={({ pressed }) => [styles.btnGhost, pressed && styles.pressed]}>
            <Text style={styles.btnGhostText}>🏠 Главная</Text>
          </Pressable>
        </View>
        {onDelete && (
          <Pressable onPress={onDelete} style={({ pressed }) => [styles.btnDelete, pressed && styles.pressed]}>
            <Text style={styles.btnDeleteText}>Удалить из истории</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.method}>
        Методика: метаданные/контейнер, статистика шума, 2D-Фурье, признаки периодических
        артефактов, анализ шумового фона и спектра аудио. Оценка вероятностная.
      </Text>
      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.l, paddingTop: spacing.l },
  fileRow: { flexDirection: 'row', gap: spacing.m, alignItems: 'center' },
  fileIcon: { fontSize: 26 },
  fileName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  fileMeta: { color: colors.textFaint, fontSize: 12, marginTop: 3 },
  powersRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, marginTop: spacing.m },
  powerLabel: { fontSize: 12.5, fontWeight: '800', minWidth: 58 },
  powersTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.human + '55',
    overflow: 'hidden',
  },
  powersAi: { height: 10, backgroundColor: colors.ai },
  group: { marginBottom: spacing.s },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: spacing.s },
  groupDot: { width: 9, height: 9, borderRadius: 5 },
  groupTitle: { fontSize: 14, fontWeight: '800' },
  techGrid: { gap: 7 },
  techRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.m },
  techKey: { color: colors.textFaint, fontSize: 13, flexShrink: 0 },
  techVal: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
    fontFamily: 'monospace',
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.m },
  warnTitle: { color: colors.mixed, fontSize: 14, fontWeight: '700', marginBottom: 6 },
  warnText: { color: colors.textDim, fontSize: 12.5, lineHeight: 18 },
  actions: { marginTop: spacing.l, gap: spacing.s },
  actionsRow: { flexDirection: 'row', gap: spacing.s },
  btnPrimary: {
    backgroundColor: colors.accent,
    borderRadius: radius.m,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnPrimaryText: { color: '#04141A', fontSize: 15.5, fontWeight: '800' },
  btnGhost: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    borderRadius: radius.m,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnGhostText: { color: colors.text, fontSize: 13.5, fontWeight: '700' },
  btnDelete: { paddingVertical: 8, alignItems: 'center' },
  btnDeleteText: { color: colors.textFaint, fontSize: 12.5 },
  pressed: { opacity: 0.7 },
  method: {
    color: colors.textFaint,
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: spacing.l,
  },
});
