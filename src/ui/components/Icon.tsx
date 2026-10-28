import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/**
 * Единый набор минималистичных контурных иконок (outline, stroke).
 * Везде один стиль: 24×24, скруглённые концы, currentColor через prop color.
 */
export interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

const prep = (size: number | undefined, color: string | undefined, sw: number | undefined) => ({
  width: size ?? 20,
  height: size ?? 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: color ?? '#E8ECF4',
  strokeWidth: sw ?? 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export const IconPhoto: React.FC<IconProps> = ({ size, color, strokeWidth }) => (
  <Svg {...prep(size, color, strokeWidth)}>
    <Rect x="3" y="5" width="18" height="14" rx="2.5" />
    <Circle cx="8.5" cy="10" r="1.5" />
    <Path d="M21 15.5L16.2 10.7 7.5 19.5" />
  </Svg>
);

export const IconVideo: React.FC<IconProps> = ({ size, color, strokeWidth }) => (
  <Svg {...prep(size, color, strokeWidth)}>
    <Rect x="3" y="5" width="18" height="14" rx="2.5" />
    <Path d="M10.2 9.3l4.8 2.7-4.8 2.7z" />
  </Svg>
);

export const IconAudio: React.FC<IconProps> = ({ size, color, strokeWidth }) => (
  <Svg {...prep(size, color, strokeWidth)}>
    <Path d="M4 10.5v3M8 7.5v9M12 4.5v15M16 8.5v7M20 11v2" />
  </Svg>
);

export const IconUpload: React.FC<IconProps> = ({ size, color, strokeWidth }) => (
  <Svg {...prep(size, color, strokeWidth)}>
    <Path d="M12 15.5V4.5" />
    <Path d="M7.8 8.7L12 4.5l4.2 4.2" />
    <Path d="M4.5 14.5v3A2.5 2.5 0 007 20h10a2.5 2.5 0 002.5-2.5v-3" />
  </Svg>
);

export const IconInfo: React.FC<IconProps> = ({ size, color, strokeWidth }) => (
  <Svg {...prep(size, color, strokeWidth)}>
    <Circle cx="12" cy="12" r="8.5" />
    <Path d="M12 11.2v4.8" />
    <Path d="M12 8.2h.01" />
  </Svg>
);

export const IconClock: React.FC<IconProps> = ({ size, color, strokeWidth }) => (
  <Svg {...prep(size, color, strokeWidth)}>
    <Circle cx="12" cy="12" r="8.5" />
    <Path d="M12 7.5V12l3 1.8" />
  </Svg>
);

export const IconShield: React.FC<IconProps> = ({ size, color, strokeWidth }) => (
  <Svg {...prep(size, color, strokeWidth)}>
    <Path d="M12 3.5l6.8 2.7v4.9c0 4.3-2.8 7.5-6.8 8.6-4-1.1-6.8-4.3-6.8-8.6V6.2L12 3.5z" />
    <Path d="M9.3 11.9l1.9 1.9 3.6-3.8" />
  </Svg>
);

export const IconPhone: React.FC<IconProps> = ({ size, color, strokeWidth }) => (
  <Svg {...prep(size, color, strokeWidth)}>
    <Rect x="7" y="3.2" width="10" height="17.6" rx="2.5" />
    <Path d="M11 17.7h2" />
  </Svg>
);

export const IconPulse: React.FC<IconProps> = ({ size, color, strokeWidth }) => (
  <Svg {...prep(size, color, strokeWidth)}>
    <Path d="M3.5 12h3.7l2.2-5.5 4 11 2.3-5.5h4.8" />
  </Svg>
);

export const IconArrowRight: React.FC<IconProps> = ({ size, color, strokeWidth }) => (
  <Svg {...prep(size, color, strokeWidth)}>
    <Path d="M4.5 12h14" />
    <Path d="M13 6.5l5.5 5.5L13 17.5" />
  </Svg>
);

export const IconChevronRight: React.FC<IconProps> = ({ size, color, strokeWidth }) => (
  <Svg {...prep(size, color, strokeWidth)}>
    <Path d="M9.5 5.5l6.5 6.5-6.5 6.5" />
  </Svg>
);

/** Шеврон-разворот: вправо (свёрнут) или вверх (раскрыт). */
export const IconChevron: React.FC<IconProps & { up?: boolean }> = ({
  size,
  color,
  strokeWidth,
  up,
}) =>
  up ? (
    <Svg {...prep(size, color, strokeWidth)}>
      <Path d="M5.5 14.5l6.5-6.5 6.5 6.5" />
    </Svg>
  ) : (
    <Svg {...prep(size, color, strokeWidth)}>
      <Path d="M5.5 9.5l6.5 6.5 6.5-6.5" />
    </Svg>
  );

export const IconSpark: React.FC<IconProps> = ({ size, color, strokeWidth }) => (
  <Svg {...prep(size, color, strokeWidth)}>
    <Path d="M11 3.5l1.7 4.4 4.4 1.7-4.4 1.7L11 15.7 9.3 11.3 4.9 9.6l4.4-1.7L11 3.5z" />
    <Path d="M17.8 14.6l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z" />
  </Svg>
);

export const IconCamera: React.FC<IconProps> = ({ size, color, strokeWidth }) => (
  <Svg {...prep(size, color, strokeWidth)}>
    <Path d="M4.5 8.8A2.3 2.3 0 016.8 6.5h1.4L9.7 4.5h4.6l1.5 2h1.4a2.3 2.3 0 012.3 2.3v7.4a2.3 2.3 0 01-2.3 2.3H6.8a2.3 2.3 0 01-2.3-2.3V8.8z" />
    <Circle cx="12" cy="12.4" r="3.1" />
  </Svg>
);

export const IconShuffle: React.FC<IconProps> = ({ size, color, strokeWidth }) => (
  <Svg {...prep(size, color, strokeWidth)}>
    <Path d="M4 7.5h3.2c4.8 0 4.3 9 9.1 9H20" />
    <Path d="M4 16.5h3.2c2 0 2.9-1.6 3.8-3.3" />
    <Path d="M14.3 8.5c.8-.9 1.7-1 2.6-1H20" />
    <Path d="M17.6 4.7L20.5 7.5l-2.9 2.8" />
    <Path d="M17.6 13.7l2.9 2.8-2.9 2.8" />
  </Svg>
);

export const IconHelp: React.FC<IconProps> = ({ size, color, strokeWidth }) => (
  <Svg {...prep(size, color, strokeWidth)}>
    <Circle cx="12" cy="12" r="8.5" />
    <Path d="M9.7 9.6a2.4 2.4 0 113.9 2.3c-.9.6-1.6 1-1.6 2.1" />
    <Path d="M12 17h.01" />
  </Svg>
);

export const IconShare: React.FC<IconProps> = ({ size, color, strokeWidth }) => (
  <Svg {...prep(size, color, strokeWidth)}>
    <Circle cx="17.8" cy="5.8" r="2.3" />
    <Circle cx="6.2" cy="12" r="2.3" />
    <Circle cx="17.8" cy="18.2" r="2.3" />
    <Path d="M8.3 10.9l7.2-4M8.3 13.1l7.2 4" />
  </Svg>
);

export const IconRefresh: React.FC<IconProps> = ({ size, color, strokeWidth }) => (
  <Svg {...prep(size, color, strokeWidth)}>
    <Path d="M19.5 12a7.5 7.5 0 11-2.2-5.3" />
    <Path d="M19.5 4.5v4.2h-4.2" />
  </Svg>
);

export const IconHome: React.FC<IconProps> = ({ size, color, strokeWidth }) => (
  <Svg {...prep(size, color, strokeWidth)}>
    <Path d="M4.5 11L12 4.5l7.5 6.5" />
    <Path d="M6.8 9.6V19a.9.9 0 00.9.9h8.6a.9.9 0 00.9-.9V9.6" />
    <Path d="M10.3 19.9v-5h3.4v5" />
  </Svg>
);

export const IconFile: React.FC<IconProps> = ({ size, color, strokeWidth }) => (
  <Svg {...prep(size, color, strokeWidth)}>
    <Path d="M6.5 3.5h7L18.5 8.5v11a1.5 1.5 0 01-1.5 1.5h-10a1.5 1.5 0 01-1.5-1.5v-14a1.5 1.5 0 011.5-1.5z" />
    <Path d="M13.5 3.5v5h5" />
  </Svg>
);

/** Иконка по типу медиа (для строк файлов). */
export const KindIcon: React.FC<IconProps & { kind: 'photo' | 'video' | 'audio' }> = ({
  kind,
  size,
  color,
  strokeWidth,
}) => {
  if (kind === 'photo') { return <IconPhoto size={size} color={color} strokeWidth={strokeWidth} />; }
  if (kind === 'video') { return <IconVideo size={size} color={color} strokeWidth={strokeWidth} />; }
  return <IconAudio size={size} color={color} strokeWidth={strokeWidth} />;
};

/** Иконка вердикта в едином контурном стиле. */
export const VerdictIcon: React.FC<
  IconProps & { verdict: 'AI' | 'HUMAN' | 'MIXED' | 'UNCERTAIN' }
> = ({ verdict, size, color, strokeWidth }) => {
  if (verdict === 'AI') { return <IconSpark size={size} color={color} strokeWidth={strokeWidth} />; }
  if (verdict === 'HUMAN') { return <IconCamera size={size} color={color} strokeWidth={strokeWidth} />; }
  if (verdict === 'MIXED') { return <IconShuffle size={size} color={color} strokeWidth={strokeWidth} />; }
  return <IconHelp size={size} color={color} strokeWidth={strokeWidth} />;
};
