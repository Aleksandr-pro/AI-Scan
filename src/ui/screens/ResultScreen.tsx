import React, { useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AnalysisResult, EvidenceSide, MediaKind } from '../../core/types';
import { buildBasis, weightBreakdown } from '../../core/scoring';
import { buildReport } from '../../core/report';
import { colors, spacing } from '../theme';
import { fmtBytes, fmtDate, fmtDuration, KIND_LABEL } from '../format';
import { Card, SectionTitle } from '../components/Card';
import { CategoryChip, IndicatorItem, VerdictHero } from '../components/Result';
import { IconChevron, IconHome, IconRefresh, IconShare, KindIcon } from '../components/Icon';

interface Props {
  result: AnalysisResult;
  onScanAgain: () => void;
  onHome: () => void;
  onDelete?: () => void;
}

/** Методика — своими словами, без жаргона чужого типа файла. */
const METHOD_TEXT: Record<MediaKind, string> = {
  photo:
    'Методика: чтение EXIF/метаданных, статистика шума и текстуры кадра, ' +
    '2D-спектральный анализ и поиск периодических артефактов. Оценка вероятностная.',
  audio:
    'Методика: разбор служебных полей тегов, анализ шумового фона, ' +
    'спектра и динамики записи. Оценка вероятностная.',
  video:
    'Методика: служебные данные контейнера, попиксельный анализ извлечённых ' +
    'кадров и проверка звуковой дорожки. Оценка вероятностная.',
};

/** Технические ключи прячем в «Подробнее» — снаружи только человеческие строки. */

export function ResultScreen({ result, onScanAgain, onHome, onDelete }: Props) {
  const [shared, setShared] = useState(false);
  const [showWeak, setShowWeak] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

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

  const t = result.tech;
  const tech: Array<[string, string]> = [];
  if (t.width && t.height) { tech.push(['Разрешение', `${t.width}×${t.height}`]); }
  if (t.durationMs) { tech.push(['Длительность', fmtDuration(t.durationMs)]); }
  if (t.sampleRate) { tech.push(['Частота дискретизации', `${t.sampleRate} Гц`]); }
  if (t.channels) { tech.push(['Каналы', String(t.channels)]); }
  if (t.frameRate) { tech.push(['Кадров/с', String(t.frameRate)]); }
  tech.push(['Размер файла', fmtBytes(t.fileSize)]);
  tech.push(['Тип', KIND_LABEL[t.mediaKind]]);
  tech.push(['Проверен', fmtDate(result.createdAt)]);

  const rawTech: Array<[string, string]> = [];
  if (t.mimeType) { rawTech.push(['MIME', t.mimeType]); }
  if (t.bitrate) { rawTech.push(['Битрейт', `${Math.round(t.bitrate / 1000)} кбит/с`]); }
  if (t.codec) { rawTech.push(['Кодек', t.codec]); }
  if (t.extra) {
    for (const [k, v] of Object.entries(t.extra)) {
      if (v !== undefined && v !== null && String(v).length > 0) {
        rawTech.push([k, String(v)]);
      }
    }
  }
  rawTech.push(['Оценка', `${result.score >= 0 ? '+' : ''}${result.score} (±100)`]);
  rawTech.push(['Сумма признаков', weightBreakdown(result.indicators)]);

  const weakOnes = result.indicators.filter(i => Math.abs(i.weight) <= 8);
  const visibleCount = result.indicators.length - weakOnes.length;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <VerdictHero
        verdict={result.verdict}
        label={result.verdictLabel}
        confidence={result.confidence}
        score={result.score}
        basis={buildBasis(result.indicators)}
      />

      {/* Шапка файла: превью + имя, без оценки (она в техданных). */}
      <View style={styles.fileBlock}>
        <FilePreview result={result} />
        <View style={{ flex: 1 }}>
          <Text style={styles.fileName} numberOfLines={2}>{t.fileName}</Text>
          <Text style={styles.fileMeta}>
            {fmtBytes(t.fileSize)} · {KIND_LABEL[t.mediaKind]}
          </Text>
        </View>
      </View>

      <SectionTitle
        title="Признаки и почему они важны"
        hint={`${visibleCount} шт.`}
      />
      {groups.map(g => {
        const list = result.indicators
          .filter(i => i.side === g.side && Math.abs(i.weight) > 8)
          .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
        if (list.length === 0) { return null; }
        // «Найденные метки» (метаданные/контейнер) vs «Анализ содержимого».
        const tagged = list.filter(
          i => i.category === 'metadata' || i.category === 'container',
        );
        const measured = list.filter(
          i => i.category !== 'metadata' && i.category !== 'container',
        );
        const gColor =
          g.side === 'ai' ? colors.ai : g.side === 'human' ? colors.human : colors.neutral;
        return (
          <View key={g.side} style={styles.group}>
            <View style={styles.groupHead}>
              <View style={[styles.groupDot, { backgroundColor: gColor }]} />
              <Text style={[styles.groupTitle, { color: gColor }]}>{g.title}</Text>
            </View>
            {tagged.length > 0 && (
              <>
                <Text style={styles.subGroup}>Найденные метки</Text>
                {tagged.map(i => (
                  <IndicatorItem key={i.id} item={i} />
                ))}
              </>
            )}
            {measured.length > 0 && (
              <>
                <Text style={styles.subGroup}>Анализ содержимого</Text>
                {measured.map(i => (
                  <IndicatorItem key={i.id} item={i} />
                ))}
              </>
            )}
          </View>
        );
      })}

      {weakOnes.length > 0 && (
        <View style={styles.weakBlock}>
          <Pressable
            onPress={() => setShowWeak(v => !v)}
            style={({ pressed }) => [styles.weakRow, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.weakTitle}>Менее важные ({weakOnes.length})</Text>
            <IconChevron
              size={16}
              color={colors.textFaint}
              up={showWeak}
            />
          </Pressable>
          {showWeak && (
            <View>
              {weakOnes
                .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
                .map(i => (
                  <IndicatorItem key={i.id} item={i} />
                ))}
            </View>
          )}
        </View>
      )}

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
        <Pressable
          onPress={() => setShowRaw(v => !v)}
          style={({ pressed }) => [styles.rawToggle, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.rawToggleText}>
            {showRaw ? 'Скрыть подробности' : 'Подробнее'}
          </Text>
          <IconChevron size={15} color={colors.accent} up={showRaw} />
        </Pressable>
        {showRaw && (
          <View style={styles.techGrid}>
            {rawTech.map(([k, v]) => (
              <View key={k} style={styles.techRow}>
                <Text style={styles.techKey}>{k}</Text>
                <Text style={styles.techRaw} numberOfLines={3}>{v}</Text>
              </View>
            ))}
          </View>
        )}
        <View style={styles.chipWrap}>
          {Array.from(new Set(result.indicators.map(i => i.category))).map(c => (
            <CategoryChip key={c} category={c} />
          ))}
        </View>
      </Card>

      {result.warnings.length > 0 && (
        <View style={styles.warnBlock}>
          <Text style={styles.warnTitle}>Примечания анализа</Text>
          {result.warnings.map((w, idx) => (
            <Text key={idx} style={styles.warnText}>• {w}</Text>
          ))}
        </View>
      )}

      <View style={styles.actions}>
        <Pressable onPress={onShare} style={({ pressed }) => [styles.btnPrimary, pressed && styles.pressed]}>
          <IconShare size={17} color="#062730" strokeWidth={2} />
          <Text style={styles.btnPrimaryText}>{shared ? 'Отчёт отправлен' : 'Поделиться отчётом'}</Text>
        </Pressable>
        <View style={styles.actionsRow}>
          <Pressable onPress={onScanAgain} style={({ pressed }) => [styles.btnGhost, pressed && styles.pressed]}>
            <IconRefresh size={16} color={colors.textDim} />
            <Text style={styles.btnGhostText}>Сканировать ещё</Text>
          </Pressable>
          <Pressable onPress={onHome} style={({ pressed }) => [styles.btnGhost, pressed && styles.pressed]}>
            <IconHome size={16} color={colors.textDim} />
            <Text style={styles.btnGhostText}>Главная</Text>
          </Pressable>
        </View>
        {onDelete && (
          <Pressable onPress={onDelete} style={({ pressed }) => [styles.btnDelete, pressed && styles.pressed]}>
            <Text style={styles.btnDeleteText}>Удалить из истории</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.method}>{METHOD_TEXT[t.mediaKind]}</Text>
      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

/** Превью в шапке: фото/кадр видео — миниатюра, аудио — волновая форма. */
function FilePreview({ result }: { result: AnalysisResult }) {
  const t = result.tech;
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = !imgFailed && !!t.previewUri && t.mediaKind !== 'audio';
  const wave = t.waveform && t.waveform.length > 0 ? t.waveform : null;

  if (showImage) {
    return (
      <Image
        source={{ uri: t.previewUri! }}
        style={styles.preview}
        onError={() => setImgFailed(true)}
        resizeMode="cover"
      />
    );
  }
  if (t.mediaKind === 'audio' && wave) {
    return (
      <View style={[styles.preview, styles.previewWave]}>
        {wave.slice(0, 14).map((v, idx) => (
          <View
            key={idx}
            style={[
              styles.waveBar,
              { height: Math.max(3, Math.round(v * 34)) },
            ]}
          />
        ))}
      </View>
    );
  }
  return (
    <View style={[styles.preview, styles.previewFallback]}>
      <KindIcon kind={t.mediaKind} size={22} color={colors.textDim} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.l, paddingTop: spacing.l },
  fileBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    paddingBottom: spacing.l,
    marginBottom: spacing.s,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  preview: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.bgElevated,
    overflow: 'hidden',
  },
  previewFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardBorder,
  },
  previewWave: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 6,
  },
  waveBar: {
    width: 2,
    borderRadius: 1,
    backgroundColor: colors.accent,
    opacity: 0.75,
  },
  fileName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  fileMeta: { color: colors.textFaint, fontSize: 12, marginTop: 3 },
  group: { marginBottom: spacing.s },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: spacing.s },
  groupDot: { width: 9, height: 9, borderRadius: 5 },
  groupTitle: { fontSize: 14, fontWeight: '800' },
  subGroup: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginLeft: 16,
  },
  weakBlock: {
    marginTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  weakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  weakTitle: { color: colors.textFaint, fontSize: 13, fontWeight: '700' },
  techGrid: { gap: 7 },
  techRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.m },
  techKey: { color: colors.textFaint, fontSize: 13, flexShrink: 0 },
  techVal: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
  },
  techRaw: {
    color: colors.textDim,
    fontSize: 12,
    textAlign: 'right',
    flex: 1,
    fontFamily: 'monospace',
  },
  rawToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 11,
    marginTop: 4,
  },
  rawToggleText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.m },
  warnBlock: {
    marginTop: spacing.m,
    paddingTop: spacing.m,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  warnTitle: { color: colors.textFaint, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6 },
  warnText: { color: colors.textDim, fontSize: 12.5, lineHeight: 18 },
  actions: { marginTop: spacing.l, gap: spacing.s },
  actionsRow: { flexDirection: 'row', gap: spacing.s },
  btnPrimary: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  btnPrimaryText: { color: '#062730', fontSize: 15, fontWeight: '800' },
  btnGhost: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderRadius: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  btnGhostText: { color: colors.textDim, fontSize: 13.5, fontWeight: '700' },
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
