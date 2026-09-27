import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Alert,
  ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AuthService } from '../services/auth';
import { testServerConnection } from '../services/api';
import {
  getApiBaseUrl,
  setApiBaseUrl,
  refreshApiBaseUrl,
  normalizeApiUrl,
  describeApiSource,
  applyServerFromQr,
} from '../services/serverConfig';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTheme } from '../contexts/ThemeContext';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { ThemeToggle } from '../components/ThemeToggle';

export default function LoginScreen() {
  const [username, setUsername]       = useState('');
  const [password, setPassword]       = useState('');
  const [loading, setLoading]         = useState(false);
  const [serverUrl, setServerUrl]     = useState('');
  const [serverSource, setServerSource] = useState('');
  const [scanning, setScanning]       = useState(true);
  const [testingServer, setTesting]   = useState(false);
  const [savingIp, setSavingIp]       = useState(false);

  // Manual IP entry state
  const [manualIp, setManualIp]       = useState('');
  const [showIpPanel, setShowIpPanel] = useState(false);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [qrScanned, setQrScanned] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const ipInputRef = useRef<TextInput>(null);
  const { colors } = useTheme();

  const styles = useThemedStyles((c) => ({
    outer:       { flex: 1, backgroundColor: c.background },
    scroll:      { flexGrow: 1, justifyContent: 'center', padding: 24 },
    topBar:      { position: 'absolute' as const, top: 48, right: 24, zIndex: 10 },

    // Logo
    logoWrap:    { alignItems: 'center' as const, marginBottom: 40 },
    iconBox:     {
      width: 88, height: 88, backgroundColor: c.primary,
      borderRadius: 22, justifyContent: 'center' as const,
      alignItems: 'center' as const, marginBottom: 14,
    },
    appName:     { fontSize: 30, fontWeight: 'bold' as const, color: c.text },
    tagline:     { fontSize: 15, color: c.textMuted, marginTop: 6 },

    // Login card
    card:        { backgroundColor: c.surface, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: c.border },
    fieldGroup:  { marginBottom: 18 },
    label:       { fontSize: 14, fontWeight: '600' as const, color: c.textSecondary, marginBottom: 8 },
    inputRow:    {
      flexDirection: 'row' as const, alignItems: 'center' as const,
      backgroundColor: c.inputBackground, borderWidth: 1,
      borderColor: c.border, borderRadius: 12, paddingHorizontal: 14,
    },
    inputIcon:   { marginRight: 10 },
    textInput:   { flex: 1, paddingVertical: 15, fontSize: 16, color: c.text },
    loginBtn:    {
      backgroundColor: c.primary, borderRadius: 12,
      paddingVertical: 15, alignItems: 'center' as const, marginTop: 6,
    },
    loginBtnOff: { backgroundColor: c.iconMuted },
    loginBtnTxt: { color: c.onPrimary, fontSize: 16, fontWeight: 'bold' as const },

    // Server banner
    banner:      {
      marginTop: 18, padding: 16, backgroundColor: c.surface,
      borderRadius: 14, borderWidth: 1, borderColor: c.border,
    },
    bannerRow:   { flexDirection: 'row' as const, alignItems: 'flex-start' as const },
    bannerText:  { flex: 1, marginLeft: 10 },
    bannerLabel: { fontSize: 12, color: c.textMuted, marginBottom: 3 },
    bannerUrl:   { fontSize: 14, fontWeight: '600' as const, color: c.text },
    bannerSrc:   { fontSize: 11, color: c.placeholder, marginTop: 3 },
    scanningTxt: { fontSize: 13, color: c.textMuted, marginTop: 6 },
    actionRow:   { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 12, marginTop: 12 },
    linkBtn:     { paddingVertical: 4 },
    linkTxt:     { fontSize: 13, color: c.primary, fontWeight: '600' as const },

    // IP entry panel
    ipPanel:     {
      marginTop: 12, padding: 16, backgroundColor: c.backgroundSecondary,
      borderRadius: 12, borderWidth: 1, borderColor: c.border,
    },
    ipTitle:     { fontSize: 13, fontWeight: '700' as const, color: c.text, marginBottom: 4 },
    ipHint:      { fontSize: 12, color: c.textMuted, marginBottom: 10, lineHeight: 18 },
    ipRow:       { flexDirection: 'row' as const, gap: 8 },
    ipInput:     {
      flex: 1, backgroundColor: c.inputBackground, borderWidth: 1.5,
      borderColor: c.primary, borderRadius: 10, paddingHorizontal: 12,
      paddingVertical: 11, fontSize: 16, color: c.text, fontVariant: ['tabular-nums'] as any,
    },
    ipSaveBtn:   {
      backgroundColor: c.primary, borderRadius: 10,
      paddingHorizontal: 18, justifyContent: 'center' as const,
      alignItems: 'center' as const,
    },
    ipSaveTxt:   { color: c.onPrimary, fontWeight: '700' as const, fontSize: 14 },
    ipExample:   { fontSize: 11, color: c.placeholder, marginTop: 6 },

    qrOverlay: {
      ...StyleSheet.absoluteFill,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    qrFrame: {
      width: 240,
      height: 240,
      borderWidth: 2,
      borderColor: c.success,
      borderRadius: 16,
      backgroundColor: 'transparent',
    },
    qrModal: { flex: 1, backgroundColor: '#000' },
    qrHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 48,
      paddingBottom: 12,
    },
    qrTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
    qrHint: { color: 'rgba(255,255,255,0.85)', textAlign: 'center', paddingHorizontal: 24, marginTop: 16, fontSize: 14 },
  }));

  // ── auto-discovery on mount ────────────────────────────────────────
  const discoverServer = useCallback(async (force = false) => {
    setScanning(true);
    try {
      const url = force ? await refreshApiBaseUrl() : await getApiBaseUrl();
      setServerUrl(url);
      setServerSource(describeApiSource());
    } finally {
      setScanning(false);
    }
  }, []);

  useEffect(() => { discoverServer(false); }, [discoverServer]);

  // ── save manual IP ────────────────────────────────────────────────
  const handleSaveIp = async () => {
    const raw = manualIp.trim();
    if (!raw) {
      Alert.alert('Enter an IP', 'Type your server IP address first, e.g. 192.168.9.111');
      return;
    }

    // Accept plain IP, IP:port, or full URL (http:// or https://)
    let input = raw;
    if (/^[\d.]+$/.test(input)) {
      input = `${input}:8000`;
    }
    const normalized = normalizeApiUrl(input);

    setSavingIp(true);
    try {
      // 1. Save the new URL first — this clears the old cache immediately
      await setApiBaseUrl(normalized);

      // 2. Update the UI to show the new URL
      setServerUrl(normalized);
      setServerSource('saved manually');
      setShowIpPanel(false);
      setManualIp('');

      // 3. Now test the newly saved URL
      const result = await testServerConnection(normalized);
      if (result.ok) {
        Alert.alert(
          '✓ Connected!',
          `Server found at:\n${normalized}\n\nYou can now log in.`,
        );
      } else {
        Alert.alert(
          'Saved — but not reachable yet',
          `IP saved as:\n${normalized}\n\n` +
          'The server did not respond. Check:\n' +
          '• Django is running: python manage.py runserver 0.0.0.0:8000\n' +
          '• Phone and PC are on the same Wi-Fi\n' +
          '• The IP shown in ipconfig matches what you typed',
        );
      }
    } catch (e) {
      Alert.alert('Error', 'Could not save the IP. Please try again.');
    } finally {
      setSavingIp(false);
    }
  };

  const openQrScanner = async () => {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert('Camera needed', 'Allow camera access to scan the QR code from the web dashboard.');
        return;
      }
    }
    setQrScanned(false);
    setShowQrScanner(true);
  };

  const handleQrScanned = async ({ data }: { data: string }) => {
    if (qrScanned) return;
    setQrScanned(true);
    setShowQrScanner(false);

    const result = await applyServerFromQr(data);
    setServerUrl(result.url);
    setServerSource(
      result.mode === 'online' ? 'from dashboard QR (online · HTTPS)' : 'from dashboard QR (local · HTTP)'
    );

    Alert.alert(
      result.ok ? 'Server connected' : 'Server saved',
      result.message,
      [{ text: 'OK' }]
    );
  };

  // ── test connection ───────────────────────────────────────────────
  const handleTest = async () => {
    setTesting(true);
    const result = await testServerConnection();
    setTesting(false);
    setServerUrl(result.url);
    Alert.alert(result.ok ? '✓ Connection OK' : 'Connection failed', result.message);
  };

  // ── login ─────────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!username.trim() || !password) {
      Alert.alert('Missing fields', 'Please enter both username and password.');
      return;
    }
    setLoading(true);
    try {
      const ok = await AuthService.login(username.trim(), password);
      if (ok) {
        router.replace('/(tabs)');
      } else {
        Alert.alert('Login failed', 'Wrong username or password.');
      }
    } catch {
      Alert.alert(
        'Cannot reach server',
        `Could not connect to:\n${serverUrl || 'unknown'}\n\n` +
        'Steps to fix:\n' +
        '1. Scan QR from the web dashboard (Local or Online tab)\n' +
        '2. Or enter server manually below\n' +
        '3. Local: same Wi‑Fi + runserver 0.0.0.0:8000 · Online: use https:// URL',
      );
    } finally {
      setLoading(false);
    }
  };

  // ── render ────────────────────────────────────────────────────────
  const connectedColor = scanning ? colors.iconMuted : colors.success;

  if (showQrScanner) {
    return (
      <View style={styles.qrModal}>
        <View style={styles.qrHeader}>
          <Text style={styles.qrTitle}>Scan dashboard QR</Text>
          <TouchableOpacity onPress={() => setShowQrScanner(false)}>
            <Ionicons name="close-circle" size={32} color="#ffffff" />
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1 }}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            mute
            onBarcodeScanned={qrScanned ? undefined : handleQrScanned}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          />
          <View style={styles.qrOverlay} pointerEvents="none">
            <View style={styles.qrFrame} />
          </View>
        </View>
        <Text style={styles.qrHint}>
          On the web dashboard: Connect mobile app → Local (HTTP) or Online (HTTPS), then scan here.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.outer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        <View style={styles.topBar}>
          <ThemeToggle />
        </View>

        {/* Logo */}
        <View style={styles.logoWrap}>
          <View style={styles.iconBox}>
            <Ionicons name="cube" size={52} color={colors.iconOnPrimary} />
          </View>
          <Text style={styles.appName}>InventoryPro</Text>
          <Text style={styles.tagline}>Manager & Cashier Portal</Text>
        </View>

        {/* Login form */}
        <View style={styles.card}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Username</Text>
            <View style={styles.inputRow}>
              <Ionicons name="person-outline" size={20} color={colors.iconMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="Enter username"
                placeholderTextColor={colors.placeholder}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.iconMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="Enter password"
                placeholderTextColor={colors.placeholder}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.loginBtnOff]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={colors.onPrimary} />
              : <Text style={styles.loginBtnTxt}>Sign In</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Server connection banner */}
        <View style={styles.banner}>
          <View style={styles.bannerRow}>
            <Ionicons name="wifi-outline" size={22} color={connectedColor} />
            <View style={styles.bannerText}>
              <Text style={styles.bannerLabel}>Backend server</Text>
              {scanning ? (
                <Text style={styles.scanningTxt}>Searching for server on your Wi-Fi…</Text>
              ) : (
                <>
                  <Text style={styles.bannerUrl} selectable numberOfLines={1}>
                    {serverUrl || 'Not found'}
                  </Text>
                  <Text style={styles.bannerSrc}>{serverSource}</Text>
                </>
              )}
            </View>
            {scanning && <ActivityIndicator size="small" color={colors.primary} />}
          </View>

          {/* Action buttons */}
          {!scanning && (
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.linkBtn} onPress={openQrScanner}>
                <Text style={[styles.linkTxt, { color: colors.success }]}>Scan QR from dashboard</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.linkBtn} onPress={handleTest} disabled={testingServer}>
                {testingServer
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : <Text style={styles.linkTxt}>Test connection</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity style={styles.linkBtn} onPress={() => discoverServer(true)}>
                <Text style={styles.linkTxt}>Scan Wi-Fi again</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.linkBtn}
                onPress={() => {
                  setShowIpPanel((v) => !v);
                  // Pre-fill with current IP if it's not localhost
                  if (!showIpPanel && serverUrl && !serverUrl.includes('localhost')) {
                    const ip = serverUrl.replace(/^https?:\/\//i, '').split(':')[0];
                    setManualIp(ip);
                  }
                  setTimeout(() => ipInputRef.current?.focus(), 200);
                }}
              >
                <Text style={[styles.linkTxt, { color: colors.warning }]}>
                  {showIpPanel ? 'Hide server entry ↑' : 'Enter server manually ↓'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Manual IP entry panel */}
          {showIpPanel && (
            <View style={styles.ipPanel}>
              <Text style={styles.ipTitle}>Enter server address</Text>
              <Text style={styles.ipHint}>
                Local (same Wi‑Fi): IP like <Text style={{ fontWeight: 'bold' }}>192.168.1.5</Text> → uses http://{'\n'}
                Online (hosted): URL like <Text style={{ fontWeight: 'bold' }}>https://yourdomain.com</Text>
              </Text>

              <View style={styles.ipRow}>
                <TextInput
                  ref={ipInputRef}
                  style={styles.ipInput}
                  placeholder="192.168.1.5 or https://site.com"
                  placeholderTextColor={colors.placeholder}
                  value={manualIp}
                  onChangeText={setManualIp}
                  keyboardType="url"
                  returnKeyType="done"
                  onSubmitEditing={handleSaveIp}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                <TouchableOpacity style={styles.ipSaveBtn} onPress={handleSaveIp} disabled={savingIp}>
                  {savingIp
                    ? <ActivityIndicator color={colors.onPrimary} />
                    : <Text style={styles.ipSaveTxt}>Save</Text>
                  }
                </TouchableOpacity>
              </View>

              <Text style={styles.ipExample}>
                Local: 192.168.1.5 → http://192.168.1.5:8000 · Online: https://inventory.example.com
              </Text>
            </View>
          )}
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}
