export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  background: string;
  backgroundSecondary: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  borderLight: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  placeholder: string;
  primary: string;
  primaryMuted: string;
  onPrimary: string;
  success: string;
  successMuted: string;
  warning: string;
  warningMuted: string;
  danger: string;
  dangerMuted: string;
  icon: string;
  iconMuted: string;
  iconOnPrimary: string;
  tabBar: string;
  tabBarBorder: string;
  header: string;
  overlay: string;
  inputBackground: string;
  shadow: string;
}

export const lightColors: ThemeColors = {
  background: '#f3f4f6',
  backgroundSecondary: '#e5e7eb',
  surface: '#ffffff',
  surfaceElevated: '#ffffff',
  border: '#e5e7eb',
  borderLight: '#f3f4f6',
  text: '#111827',
  textSecondary: '#374151',
  textMuted: '#6b7280',
  placeholder: '#9ca3af',
  primary: '#2563eb',
  primaryMuted: '#dbeafe',
  onPrimary: '#ffffff',
  success: '#059669',
  successMuted: '#d1fae5',
  warning: '#d97706',
  warningMuted: '#fef3c7',
  danger: '#dc2626',
  dangerMuted: '#fee2e2',
  icon: '#374151',
  iconMuted: '#6b7280',
  iconOnPrimary: '#ffffff',
  tabBar: '#ffffff',
  tabBarBorder: '#e5e7eb',
  header: '#ffffff',
  overlay: 'rgba(0,0,0,0.5)',
  inputBackground: '#ffffff',
  shadow: '#000000',
};

export const darkColors: ThemeColors = {
  background: '#0f172a',
  backgroundSecondary: '#1e293b',
  surface: '#1e293b',
  surfaceElevated: '#334155',
  border: '#334155',
  borderLight: '#1e293b',
  text: '#f8fafc',
  textSecondary: '#e2e8f0',
  textMuted: '#94a3b8',
  placeholder: '#64748b',
  primary: '#3b82f6',
  primaryMuted: '#1e3a5f',
  onPrimary: '#ffffff',
  success: '#34d399',
  successMuted: '#064e3b',
  warning: '#fbbf24',
  warningMuted: '#78350f',
  danger: '#f87171',
  dangerMuted: '#7f1d1d',
  icon: '#e2e8f0',
  iconMuted: '#94a3b8',
  iconOnPrimary: '#ffffff',
  tabBar: '#1e293b',
  tabBarBorder: '#334155',
  header: '#1e293b',
  overlay: 'rgba(0,0,0,0.7)',
  inputBackground: '#334155',
  shadow: '#000000',
};
