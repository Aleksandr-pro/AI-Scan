import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';
import pkg from '../../../package.json';
import { Card, SectionTitle } from '../components/Card';

interface Props {
  onBack: () => void;
}

const METHODS: Array<{ icon: string; title: string; text: string }> = [
  {
    icon: '🏷️',
    title: 'Метаданные и контейнер',
    text:
      'EXIF (модель камеры, ПО, GPS, дата), XMP/PNG-текст, ID3/Vorbis-теги, служебные ' +
      'строки контейнера (©too, Lavf, com.android.version). Подписи генераторов ' +
      '(Midjourney, Stable Diffusion, Sora, Suno, ElevenLabs…) — прямое доказательство.',
  },
  {
    icon: '🌫️',
    title: 'Статистика шума',
    text:
      'Камера даёт зерно: случайные отклонения есть даже в самых гладких зонах и ' +
      'зависят от яркости. Генерация даёт аномально чистые поля либо нестабильное зерно, ' +
      'не совпадающее между кадрами видео.',
  },
  {
    icon: '🌊',
    title: 'Спектральный анализ (2D-Фурье)',
    text:
      'Проверяется «пол» высоких частот (есть ли настоящее оптическое зерно) и ищутся ' +
      'узкие периодические пики — сетчатые артефакты свёрточных сетей и апскейлеров ' +
      'в гладких областях кадра.',
  },
  {
    icon: '📐',
    title: 'Структура и размеры',
    text:
      'Плотность краёв, гладкость кожи, насыщенность, размеры кадра, кратные выходам ' +
      'генераторов (512/768/1024/1792 и квадраты 64×N).',
  },
  {
    icon: '🎧',
    title: 'Аудио-эвристики',
    text:
      'Шумовой фон (живая запись не бывает абсолютно тихой), жёсткий обрез спектра ' +
      '15–17 кГц (визитная карточка нейро-вокодеров), цифровая тишина, стационарность ' +
      'ВЧ-шума, микродинамика, псевдо-стерео.',
  },
  {
    icon: '🎞️',
    title: 'Видео',
    text:
      'Анализируется контейнер (аппаратный кодек телефона против Lavf/генератора), ' +
      'извлекаются кадры и прогоняются через фото-анализ, проверяется стабильность ' +
      'зерна между кадрами, при наличии — декодируется звуковая дорожка.',
  },
];

export function AboutScreen({ onBack }: Props) {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={styles.back}>‹ Назад</Text>
        </Pressable>
        <Text style={styles.title}>Как работает анализ</Text>
        <View style={{ width: 70 }} />
      </View>

      <Card>
        <Text style={styles.lead}>
          AI Scan сравнивает десятки независимых признаков и взвешивает каждый: сильные
          метаданные дороже косвенных наблюдений. Итог — вердикт с уверенностью и
          человеко-читаемым списком «почему именно так».
        </Text>
      </Card>

      {METHODS.map(m => (
        <Card key={m.title}>
          <View style={styles.methodHead}>
            <Text style={styles.methodIcon}>{m.icon}</Text>
            <Text style={styles.methodTitle}>{m.title}</Text>
          </View>
          <Text style={styles.methodText}>{m.text}</Text>
        </Card>
      ))}

      <SectionTitle title="Вердикты" />
      <Card>
        <Text style={styles.verdictLine}>
          <Text style={{ color: colors.ai, fontWeight: '800' }}>🤖 Создано/обработано ИИ</Text>
          {' — перевес признаков генерации.'}
        </Text>
        <Text style={styles.verdictLine}>
          <Text style={{ color: colors.human, fontWeight: '800' }}>📷 Создано человеком</Text>
          {' — признаки живой съёмки, ИИ не найден.'}
        </Text>
        <Text style={styles.verdictLine}>
          <Text style={{ color: colors.mixed, fontWeight: '800' }}>🔀 Смешано</Text>
          {' — сильные признаки с обеих сторон: снимок человека, обработанный нейросетью.'}
        </Text>
        <Text style={styles.verdictLine}>
          <Text style={{ color: colors.uncertain, fontWeight: '800' }}>❓ Недостаточно данных</Text>
          {' — сигналы слабы или противоречат друг другу.'}
        </Text>
      </Card>

      <SectionTitle title="Важное" />
      <Card accent={colors.mixed}>
        <Text style={styles.warn}>
          {'Оценка вероятностная, а не экспертиза. Сильные фильтры, пересжатия, скриншоты и ручная ретушь могут запутать любую автоматическую проверку. Приложение не отправляет ваши файлы в сеть — весь анализ идёт на устройстве.'}
        </Text>
      </Card>

      <Text style={styles.version}>AI Scan · версия {pkg.version}</Text>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.l, paddingTop: spacing.s },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.m,
    marginTop: spacing.s,
  },
  back: { color: colors.accent, fontSize: 15, fontWeight: '700', width: 70 },
  title: { color: colors.text, fontSize: 17, fontWeight: '800' },
  lead: { color: colors.textDim, fontSize: 14, lineHeight: 21 },
  methodHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  methodIcon: { fontSize: 22 },
  methodTitle: { color: colors.text, fontSize: 15.5, fontWeight: '800', flex: 1 },
  methodText: { color: colors.textDim, fontSize: 13.5, lineHeight: 20, marginTop: 8 },
  verdictLine: { color: colors.textDim, fontSize: 13.5, lineHeight: 22 },
  warn: { color: colors.textDim, fontSize: 13.5, lineHeight: 20 },
  version: {
    color: colors.textFaint,
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.l,
  },
});
