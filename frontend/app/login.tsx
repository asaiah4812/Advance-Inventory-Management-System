import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { AuthService } from '../services/auth';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { ThemeToggle } from '../components/ThemeToggle';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { colors } = useTheme();
  const styles = useThemedStyles((c) => ({
    container: { flex: 1, backgroundColor: c.background, justifyContent: 'center', padding: 24 },
    topBar: { position: 'absolute', top: 48, right: 24, zIndex: 10 },
    logoContainer: { alignItems: 'center', marginBottom: 48 },
    iconWrapper: {
      width: 96,
      height: 96,
      backgroundColor: c.primary,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    title: { fontSize: 32, fontWeight: 'bold', color: c.text },
    subtitle: { fontSize: 16, color: c.textMuted, marginTop: 8 },
    formContainer: {
      backgroundColor: c.surface,
      borderRadius: 24,
      padding: 24,
      borderWidth: 1,
      borderColor: c.border,
    },
    inputGroup: { marginBottom: 20 },
    label: { fontSize: 14, fontWeight: '600', color: c.textSecondary, marginBottom: 8 },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.inputBackground,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: 16,
    },
    inputIcon: { marginRight: 12 },
    input: { flex: 1, paddingVertical: 16, fontSize: 16, color: c.text },
    loginButton: {
      backgroundColor: c.primary,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 8,
    },
    loginButtonDisabled: { backgroundColor: c.iconMuted },
    loginButtonText: { color: c.onPrimary, fontSize: 16, fontWeight: 'bold' },
  }));

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('Error', 'Please enter both username and password');
      return;
    }
    setLoading(true);
    try {
      const success = await AuthService.login(username, password);
      if (success) {
        router.replace('/(tabs)');
      } else {
        Alert.alert('Login Failed', 'Invalid credentials');
      }
    } catch {
      Alert.alert('Login Error', 'Unable to connect to the server. If offline, login cannot be verified.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <ThemeToggle />
      </View>
      <View style={styles.logoContainer}>
        <View style={styles.iconWrapper}>
          <Ionicons name="cube" size={64} color={colors.iconOnPrimary} />
        </View>
        <Text style={styles.title}>InventoryPro</Text>
        <Text style={styles.subtitle}>Manager & Cashier Portal</Text>
      </View>
      <View style={styles.formContainer}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Username</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="person-outline" size={20} color={colors.iconMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter username"
              placeholderTextColor={colors.placeholder}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
          </View>
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.iconMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter password"
              placeholderTextColor={colors.placeholder}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>
        </View>
        <TouchableOpacity
          style={[styles.loginButton, loading && styles.loginButtonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.loginButtonText}>Sign In</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
