import AsyncStorage from '@react-native-async-storage/async-storage';
import { AnalysisResult } from '../core/types';

const KEY = 'aiscan.history.v1';
const MAX = 50;

export async function loadHistory(): Promise<AnalysisResult[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) { return []; }
    const list = JSON.parse(raw) as AnalysisResult[];
    if (!Array.isArray(list)) { return []; }
    return list;
  } catch {
    return [];
  }
}

export async function saveResult(result: AnalysisResult): Promise<void> {
  try {
    const list = await loadHistory();
    const next = [result, ...list.filter(r => r.id !== result.id)].slice(0, MAX);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // история не критична
  }
}

export async function removeResult(id: string): Promise<AnalysisResult[]> {
  const list = await loadHistory();
  const next = list.filter(r => r.id !== id);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export async function clearHistory(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
