import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SyncService } from '../../services/sync';
import { AuthService } from '../../services/auth';
import api from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { ThemeToggle } from '../../components/ThemeToggle';

export default function DashboardScreen() {
  const [syncQueue, setSyncQueue] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState({ today_revenue: 0, low_stock_count: 0 });
  const { colors } = useTheme();

  const styles = useThemedStyles((c) => ({
    container: { flex: 1, backgroundColor: c.background, padding: 16 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    headerActions: { flexDirection: 'row', alignItems: 'center' },
    headerActionSpacer: { width: 8 },
    logoutButton: { padding: 10, backgroundColor: c.dangerMuted, borderRadius: 12 },
    greeting: { fontSize: 16, color: c.textMuted },
    title: { fontSize: 28, fontWeight: 'bold', color: c.text },
    roleBadge: {
      fontSize: 12,
      fontWeight: 'bold',
      color: c.primary,
      backgroundColor: c.primaryMuted,
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
      marginTop: 4,
      textTransform: 'uppercase',
    },
    syncCard: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: 24,
    },
    syncHeader: { flexDirection: 'row', alignItems: 'center' },
    syncTextContainer: { marginLeft: 16, flex: 1 },
    syncTitle: { fontSize: 18, fontWeight: '600', color: c.text },
    syncSubtitle: { fontSize: 14, color: c.textMuted, marginTop: 2 },
    syncButton: {
      backgroundColor: c.primary,
      borderRadius: 8,
      paddingVertical: 12,
      alignItems: 'center',
      marginTop: 16,
    },
    syncButtonDisabled: { backgroundColor: c.iconMuted },
    syncButtonText: { color: c.onPrimary, fontWeight: '600', fontSize: 16 },
    statsContainer: { flexDirection: 'row', justifyContent: 'space-between' },
    statCard: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 20,
      width: '48%',
      borderWidth: 1,
      borderColor: c.border,
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    statValue: { fontSize: 22, fontWeight: 'bold', color: c.text },
    statLabel: { fontSize: 14, color: c.textMuted, marginTop: 4 },
  }));

  const loadData = async () => {
    try {
      const [queue, userRes, statsRes] = await Promise.all([
        SyncService.getQueue(),
        api.get('/api/me/'),
        api.get('/api/stats/'),
      ]);
      setSyncQueue(queue);
      setUser(userRes.data);
      setStats(statsRes.data);
    } catch (e) {
      console.error('Error loading dashboard data', e);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await SyncService.syncNow();
      Alert.alert('Success', 'Offline data synced successfully!');
      loadData();
    } catch {
      Alert.alert('Sync Failed', 'Could not connect to the server. Will retry later.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogout = async () => {
    await AuthService.logout();
    router.replace('/login');
  };

  const syncIconColor = syncQueue.length > 0 ? colors.warning : colors.success;
  const syncIconBg = syncQueue.length > 0 ? colors.warningMuted : colors.successMuted;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.title}>{user ? user.username : 'Loading...'}</Text>
          <Text style={styles.roleBadge}>{user?.is_superuser ? 'Manager' : 'Staff'}</Text>
        </View>
        <View style={styles.headerActions}>
          <ThemeToggle />
          <View style={styles.headerActionSpacer} />
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={22} color={colors.danger} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.syncCard}>
        <View style={styles.syncHeader}>
          <View style={[styles.iconContainer, { backgroundColor: syncIconBg, marginBottom: 0 }]}>
            <Ionicons
              name={syncQueue.length > 0 ? 'cloud-offline' : 'cloud-done'}
              size={28}
              color={syncIconColor}
            />
          </View>
          <View style={styles.syncTextContainer}>
            <Text style={styles.syncTitle}>
              {syncQueue.length > 0 ? `${syncQueue.length} Pending Syncs` : 'All synced up!'}
            </Text>
            <Text style={styles.syncSubtitle}>
              {syncQueue.length > 0 ? 'Sales queued while offline' : 'Your data is safe on the server'}
            </Text>
          </View>
        </View>
        {syncQueue.length > 0 && (
          <TouchableOpacity
            style={[styles.syncButton, isSyncing && styles.syncButtonDisabled]}
            onPress={handleSync}
            disabled={isSyncing}
          >
            <Text style={styles.syncButtonText}>{isSyncing ? 'Syncing...' : 'Sync Now'}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <View style={[styles.iconContainer, { backgroundColor: colors.primaryMuted }]}>
            <Ionicons name="cash-outline" size={24} color={colors.primary} />
          </View>
          <Text style={styles.statValue}>₦{Number(stats.today_revenue || 0).toLocaleString()}</Text>
          <Text style={styles.statLabel}>
            {user?.is_superuser ? "Today's Revenue" : "My Today's Sales"}
          </Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.iconContainer, { backgroundColor: colors.dangerMuted }]}>
            <Ionicons name="alert-circle-outline" size={24} color={colors.danger} />
          </View>
          <Text style={styles.statValue}>{stats.low_stock_count}</Text>
          <Text style={styles.statLabel}>Low Stock</Text>
        </View>
      </View>
    </ScrollView>
  );
}
