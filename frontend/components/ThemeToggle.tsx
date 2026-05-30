import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

interface ThemeToggleProps {
  size?: number;
}

export function ThemeToggle({ size = 22 }: ThemeToggleProps) {
  const { isDark, colors, toggleTheme } = useTheme();

  return (
    <TouchableOpacity
      onPress={toggleTheme}
      style={[styles.button, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
      accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <Ionicons
        name={isDark ? 'sunny' : 'moon'}
        size={size}
        color={isDark ? '#fbbf24' : colors.icon}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
});
