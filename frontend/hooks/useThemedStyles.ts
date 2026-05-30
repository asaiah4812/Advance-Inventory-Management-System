import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { ThemeColors } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';

export function useThemedStyles<T extends StyleSheet.NamedStyles<T>>(
  creator: (colors: ThemeColors) => T
): T {
  const { colors } = useTheme();
  return useMemo(() => StyleSheet.create(creator(colors)), [colors]);
}
