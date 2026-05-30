import { Stack, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthService } from '../services/auth';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';

function RootNavigator() {
  const [isReady, setIsReady] = useState(false);
  const { colors, isDark } = useTheme();

  useEffect(() => {
    const checkAuth = async () => {
      const authenticated = await AuthService.isAuthenticated();
      setIsReady(true);
      setTimeout(() => {
        if (authenticated) {
          router.replace('/(tabs)');
        } else {
          router.replace('/login');
        }
      }, 100);
    };
    checkAuth();
  }, []);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" />
        <Stack.Screen name="edit-product" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootNavigator />
    </ThemeProvider>
  );
}
