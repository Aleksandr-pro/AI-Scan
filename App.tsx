import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import DocumentPicker from 'react-native-document-picker';

import { HomeScreen } from './src/ui/screens/HomeScreen';
import { AnalyzingScreen } from './src/ui/screens/AnalyzingScreen';
import { ResultScreen } from './src/ui/screens/ResultScreen';
import { HistoryScreen } from './src/ui/screens/HistoryScreen';
import { AboutScreen } from './src/ui/screens/AboutScreen';

import { runAnalysis } from './src/core/pipeline';
import { AnalysisProgress, AnalysisResult, MediaKind } from './src/core/types';
import { clearHistory, loadHistory, removeResult, saveResult } from './src/storage/history';
import { colors } from './src/ui/theme';

type ScreenName = 'home' | 'analyzing' | 'result' | 'history' | 'about';

const MIME_BY_KIND: Record<MediaKind | 'any', string[]> = {
  photo: ['image/*'],
  video: ['video/*'],
  audio: ['audio/*'],
  any: [],
};

export default function App() {
  const [screen, setScreen] = useState<ScreenName>('home');
  const [history, setHistory] = useState<AnalysisResult[]>([]);
  const [current, setCurrent] = useState<AnalysisResult | null>(null);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [pendingName, setPendingName] = useState('');
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);
  const cancelled = useRef(false);

  useEffect(() => {
    loadHistory().then(setHistory).catch(() => {});
  }, []);

  const startPick = useCallback(async (kind: MediaKind | 'any') => {
    try {
      const res = await DocumentPicker.pickSingle({
        type: MIME_BY_KIND[kind],
        copyTo: 'cachesDirectory',
      });
      const path = res.fileCopyUri || res.uri;
      if (!path) {
        Alert.alert('Не удалось открыть файл', 'Попробуйте выбрать файл заново.');
        return;
      }
      cancelled.current = false;
      setPendingPath(path);
      setPendingName(res.name || path.split('/').pop() || 'файл');
      setProgress({ stage: 'Чтение файла', progress: 0.02 });
      setError(undefined);
      setScreen('analyzing');
    } catch (e: any) {
      if (DocumentPicker.isCancel(e)) { return; }
      Alert.alert('Ошибка выбора файла', String(e?.message ?? e));
    }
  }, []);

  // Запуск анализа при переходе на экран обработки.
  useEffect(() => {
    if (screen !== 'analyzing' || !pendingPath) { return; }
    let alive = true;
    (async () => {
      try {
        const result = await runAnalysis(pendingPath, p => {
          if (alive && !cancelled.current) {
            setProgress(p);
          }
        });
        if (!alive || cancelled.current) { return; }
        setCurrent(result);
        setHistory(prev => [result, ...prev].slice(0, 50));
        await saveResult(result);
        setScreen('result');
      } catch (e: any) {
        if (!alive || cancelled.current) { return; }
        setError(`Не удалось проанализировать файл: ${e?.message ?? e}`);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, pendingPath]);

  const goHome = useCallback(() => {
    cancelled.current = true;
    setError(undefined);
    setProgress(null);
    setPendingPath(null);
    setScreen('home');
  }, []);

  const scanAgain = useCallback(() => {
    setScreen('home');
    // Сразу открываем выбор файла.
    setTimeout(() => startPick('any'), 150);
  }, [startPick]);

  const openFromHistory = useCallback((r: AnalysisResult) => {
    setCurrent(r);
    cancelled.current = true;
    setScreen('result');
  }, []);

  const deleteCurrent = useCallback(() => {
    if (!current) { return; }
    Alert.alert('Удалить результат?', current.tech.fileName, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          const next = await removeResult(current.id);
          setHistory(next);
          setScreen('home');
        },
      },
    ]);
  }, [current]);

  const confirmClear = useCallback(() => {
    Alert.alert('Очистить историю?', 'Все сохранённые результаты будут удалены.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Очистить',
        style: 'destructive',
        onPress: async () => {
          await clearHistory();
          setHistory([]);
        },
      },
    ]);
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      {screen === 'home' && (
        <HomeScreen
          history={history}
          onPick={startPick}
          onOpenResult={openFromHistory}
          onOpenHistory={() => setScreen('history')}
          onOpenAbout={() => setScreen('about')}
        />
      )}
      {screen === 'analyzing' && (
        <AnalyzingScreen fileName={pendingName} progress={progress} error={error} />
      )}
      {screen === 'result' && current && (
        <ResultScreen
          result={current}
          onScanAgain={scanAgain}
          onHome={goHome}
          onDelete={deleteCurrent}
        />
      )}
      {screen === 'history' && (
        <HistoryScreen
          history={history}
          onOpen={openFromHistory}
          onClear={confirmClear}
          onBack={() => setScreen('home')}
        />
      )}
      {screen === 'about' && <AboutScreen onBack={() => setScreen('home')} />}

      {screen === 'analyzing' && error ? (
        <View style={styles.errorActions}>
          <Pressable onPress={goHome} style={styles.errorBtn}>
            <Text style={styles.errorBtnText}>Вернуться на главную</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setError(undefined);
              setProgress({ stage: 'Чтение файла', progress: 0.02 });
              cancelled.current = false;
              // перезапуск: смена pendingPath не нужна, форсируем эффект
              setScreen('home');
              setTimeout(() => setScreen('analyzing'), 60);
            }}
            style={[styles.errorBtn, styles.errorBtnAlt]}
          >
            <Text style={styles.errorBtnText}>Повторить</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  errorActions: {
    position: 'absolute',
    bottom: 40,
    left: 24,
    right: 24,
    flexDirection: 'row',
    gap: 10,
  },
  errorBtn: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  errorBtnAlt: { backgroundColor: colors.accentViolet },
  errorBtnText: { color: '#071018', fontWeight: '800', fontSize: 14 },
});
