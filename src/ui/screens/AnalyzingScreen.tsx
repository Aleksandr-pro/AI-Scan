import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { AnalysisProgress } from '../../core/types';
import { colors, radius, spacing } from '../theme';

interface Props {
  fileName: string;
  progress: AnalysisProgress | null;
  error?: string;
}

const STAGE_HINTS: Record<string, string> = {
  'Чтение файла': 'Копирование и открытие материала…',
  'Поиск метаданных': 'EXIF, теги, служебные записи контейнера…',
  'Декодирование звука': 'Преобразование потока в PCM…',
  'Спектральный анализ аудио': 'Окна Фурье, шумовой фон, обрез спектра…',
  'Извлечение кадров видео': 'Достаём представительные кадры…',
  'Анализ пикселей и спектров': 'Зерно, артефакты, высокие частоты…',
  'Сводка признаков видео': 'Сверка контейнера, кадров и звука…',
  'Формирование заключения': 'Взвешивание признаков и вердикт…',
};

export function AnalyzingScreen({ fileName, progress, error }: Props) {
  const spin = useRef(new Animated.Value(0)).current;
  const width = useRef(new Animated.Value(0.02)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 2400,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  useEffect(() => {
    const target = Math.max(0.02, Math.min(1, progress?.progress ?? 0.02));
    Animated.timing(width, {
      toValue: target,
      duration: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, width]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const pct = width.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const stage = progress?.stage ?? 'Подготовка…';
  const hint = STAGE_HINTS[stage] ?? 'Эвристический анализ материала…';

  return (
    <View style={styles.root}>
      <View style={styles.radarWrap}>
        <Animated.View style={[styles.radarRing, { transform: [{ rotate }] }]} />
        <Animated.View style={[styles.radarRing2, { transform: [{ rotate }] }]} />
        <Text style={styles.radarIcon}>📡</Text>
      </View>

      <Text style={styles.title}>Анализируем материал</Text>
      <Text style={styles.file} numberOfLines={2}>
        {fileName}
      </Text>

      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width: pct }]} />
      </View>
      <Text style={styles.stage}>{stage}</Text>
      <Text style={styles.hint}>{hint}</Text>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.steps}>
        {['Файл', 'Метаданные', 'DSP', 'Вердикт'].map((s, i) => {
          const p = progress?.progress ?? 0;
          const active = p >= i * 0.25;
          return (
            <Text key={s} style={[styles.step, active && styles.stepActive]}>
              {active ? '✓ ' : '· '}
              {s}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  radarWrap: {
    width: 150,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  radarRing: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 2,
    borderColor: colors.accent,
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
  },
  radarRing2: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    borderColor: colors.accentViolet,
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
  },
  radarIcon: { fontSize: 44 },
  title: { color: colors.text, fontSize: 21, fontWeight: '800' },
  file: {
    color: colors.textDim,
    fontSize: 13,
    marginTop: 6,
    maxWidth: 300,
    textAlign: 'center',
  },
  track: {
    width: '100%',
    height: 10,
    backgroundColor: colors.bgElevated,
    borderRadius: 5,
    marginTop: spacing.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  fill: {
    height: 10,
    backgroundColor: colors.accent,
    borderRadius: 5,
  },
  stage: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '700',
    marginTop: spacing.m,
  },
  hint: {
    color: colors.textFaint,
    fontSize: 12.5,
    marginTop: 4,
    textAlign: 'center',
  },
  steps: {
    flexDirection: 'row',
    gap: 14,
    marginTop: spacing.xl,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  step: { color: colors.textFaint, fontSize: 12.5, fontWeight: '600' },
  stepActive: { color: colors.human },
  errorBox: {
    marginTop: spacing.l,
    backgroundColor: colors.aiBg,
    borderColor: colors.aiBorder,
    borderWidth: 1,
    borderRadius: radius.m,
    padding: spacing.m,
    maxWidth: 340,
  },
  errorText: { color: colors.ai, fontSize: 13, textAlign: 'center', lineHeight: 18 },
});
