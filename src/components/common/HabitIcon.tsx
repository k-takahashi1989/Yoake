import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';

type HabitLike = {
  id?: string;
  label?: string;
};

type HabitIconConfig = {
  svg: string;
  color: string;
  backgroundColor: string;
  borderColor: string;
};

const sanitize = (svg: string): string =>
  svg.replace(/\s+xmlns:\w+="[^"]*"/g, '');

const colorize = (svg: string, color: string): string =>
  sanitize(svg)
    .replace(/stroke="currentColor"/gi, `stroke="${color}"`)
    .replace(/fill="currentColor"/gi, `fill="${color}"`)
    .replace(/fill="#000000"/gi, `fill="${color}"`)
    .replace(/fill="#000"/gi, `fill="${color}"`)
    .replace(/fill="rgb\(0,0,0\)"/gi, `fill="${color}"`);

const SVG_TAG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41 11 3.83a2 2 0 0 0-1.42-.59H4a2 2 0 0 0-2 2v5.59a2 2 0 0 0 .59 1.41l9.58 9.59a2 2 0 0 0 2.83 0l5.59-5.59a2 2 0 0 0 0-2.83Z"/><path d="M7 7h.01"/></svg>`;
const SVG_COFFEE = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/></svg>`;
const SVG_WINE = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 22h8"/><path d="M7 10h10"/><path d="M12 15v7"/><path d="M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z"/></svg>`;
const SVG_DUMBBELL = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z"/><path d="m2.5 21.5 1.4-1.4"/><path d="m20.1 3.9 1.4-1.4"/><path d="M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z"/><path d="m9.6 14.4 4.8-4.8"/></svg>`;
const SVG_SMARTPHONE = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>`;
const SVG_BRAIN = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 18V5"/><path d="M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4"/><path d="M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5"/><path d="M17.997 5.125a4 4 0 0 1 2.526 5.77"/><path d="M18 18a4 4 0 0 0 2-7.464"/><path d="M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517"/><path d="M6 18a4 4 0 0 1-2-7.464"/><path d="M6.003 5.125a4 4 0 0 0-2.526 5.77"/></svg>`;
const SVG_BATH = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 4 8 6"/><path d="M17 19v2"/><path d="M2 12h20"/><path d="M7 19v2"/><path d="M9 5 7.621 3.621A2.121 2.121 0 0 0 4 5v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/></svg>`;

const DEFAULT_ICON: HabitIconConfig = {
  svg: SVG_TAG,
  color: '#DCD8FF',
  backgroundColor: 'rgba(107, 92, 231, 0.14)',
  borderColor: 'rgba(107, 92, 231, 0.28)',
};

const PRESET_BY_ID: Record<string, HabitIconConfig> = {
  default_01: {
    svg: SVG_COFFEE,
    color: '#D8C3A5',
    backgroundColor: 'rgba(151, 96, 45, 0.16)',
    borderColor: 'rgba(151, 96, 45, 0.30)',
  },
  default_02: {
    svg: SVG_WINE,
    color: '#F4B35D',
    backgroundColor: 'rgba(244, 179, 93, 0.16)',
    borderColor: 'rgba(244, 179, 93, 0.30)',
  },
  default_03: {
    svg: SVG_DUMBBELL,
    color: '#79E0B5',
    backgroundColor: 'rgba(69, 185, 135, 0.16)',
    borderColor: 'rgba(69, 185, 135, 0.30)',
  },
  default_04: {
    svg: SVG_SMARTPHONE,
    color: '#8FA7FF',
    backgroundColor: 'rgba(91, 115, 214, 0.16)',
    borderColor: 'rgba(91, 115, 214, 0.30)',
  },
  default_05: {
    svg: SVG_BRAIN,
    color: '#FF9E7A',
    backgroundColor: 'rgba(255, 110, 64, 0.14)',
    borderColor: 'rgba(255, 110, 64, 0.28)',
  },
  default_06: {
    svg: SVG_BATH,
    color: '#9FE7F5',
    backgroundColor: 'rgba(114, 201, 219, 0.14)',
    borderColor: 'rgba(114, 201, 219, 0.28)',
  },
};

function normalize(value?: string): string {
  return (value ?? '').trim().toLowerCase();
}

function inferPresetByLabel(label?: string): HabitIconConfig {
  const normalized = normalize(label);

  if (normalized.includes('caffeine') || normalized.includes('coffee')) {
    return PRESET_BY_ID.default_01;
  }
  if (normalized.includes('alcohol') || normalized.includes('drink') || normalized.includes('wine')) {
    return PRESET_BY_ID.default_02;
  }
  if (normalized.includes('exercise') || normalized.includes('workout') || normalized.includes('training')) {
    return PRESET_BY_ID.default_03;
  }
  if (
    normalized.includes('phone') ||
    normalized.includes('smartphone') ||
    normalized.includes('screen')
  ) {
    return PRESET_BY_ID.default_04;
  }
  if (normalized.includes('stress') || normalized.includes('tension')) {
    return PRESET_BY_ID.default_05;
  }
  if (normalized.includes('bath') || normalized.includes('shower')) {
    return PRESET_BY_ID.default_06;
  }

  return DEFAULT_ICON;
}

export function getHabitIconConfig(habit: HabitLike): HabitIconConfig {
  if (habit.id && PRESET_BY_ID[habit.id]) {
    return PRESET_BY_ID[habit.id];
  }
  return inferPresetByLabel(habit.label);
}

interface Props {
  habit: HabitLike;
  size?: number;
  style?: StyleProp<ViewStyle>;
  backgroundColor?: string;
  borderColor?: string;
  color?: string;
}

export default function HabitIcon({
  habit,
  size = 28,
  style,
  backgroundColor,
  borderColor,
  color,
}: Props) {
  const preset = getHabitIconConfig(habit);
  const iconSize = Math.max(14, Math.round(size * 0.54));
  const xml = colorize(preset.svg, color ?? preset.color);

  return (
    <View
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.38),
          backgroundColor: backgroundColor ?? preset.backgroundColor,
          borderColor: borderColor ?? preset.borderColor,
        },
        style,
      ]}
    >
      <SvgXml xml={xml} width={iconSize} height={iconSize} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
});
