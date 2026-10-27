/** Единая тёмная тема приложения. */
export const colors = {
  bg: '#0B0E14',
  bgElevated: '#121724',
  card: '#161C2B',
  cardBorder: '#232B3E',
  text: '#E8ECF4',
  textDim: '#93A0B8',
  textFaint: '#5E6A82',
  accent: '#22D3EE',
  accentViolet: '#8B5CF6',
  ai: '#F472B6',
  aiBg: '#2A1424',
  aiBorder: '#6B2A4E',
  human: '#4ADE80',
  humanBg: '#0F2A1C',
  humanBorder: '#1F5C3B',
  mixed: '#FBBF24',
  mixedBg: '#2A2210',
  mixedBorder: '#6B5410',
  uncertain: '#94A3B8',
  uncertainBg: '#1A2130',
  uncertainBorder: '#33405A',
  neutral: '#64748B',
  danger: '#F87171',
  overlay: 'rgba(11, 14, 20, 0.92)',
} as const;

export const verdictTheme = {
  AI: { color: colors.ai, bg: colors.aiBg, border: colors.aiBorder, icon: '🤖', emoji: '⚠️' },
  HUMAN: { color: colors.human, bg: colors.humanBg, border: colors.humanBorder, icon: '📷', emoji: '✅' },
  MIXED: { color: colors.mixed, bg: colors.mixedBg, border: colors.mixedBorder, icon: '🔀', emoji: '±' },
  UNCERTAIN: {
    color: colors.uncertain,
    bg: colors.uncertainBg,
    border: colors.uncertainBorder,
    icon: '❓',
    emoji: '?',
  },
} as const;

export const spacing = {
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  s: 8,
  m: 12,
  l: 18,
  xl: 26,
} as const;

export const mono = {
  fontFamily: 'monospace',
} as const;
