import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import api from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';

type SaleItem = {
  id: number;
  product: number;
  product_name?: string;
  quantity: number;
  unit_price: string;
  subtotal: string;
};

type Sale = {
  id: string;
  cashier: number | null;
  cashier_name?: string;
  total_amount: string;
  discount: string;
  grand_total: string;
  created_at: string;
  items: SaleItem[];
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-NG', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function SalesScreen() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const { colors } = useTheme();

  const styles = useThemedStyles((c) => ({
    container: { flex: 1, backgroundColor: c.background },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.background },

    // Header
    header: {
      padding: 16,
      paddingBottom: 12,
      backgroundColor: c.surface,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    headerTitle: { fontSize: 24, fontWeight: 'bold', color: c.text },
    headerSub: { fontSize: 13, color: c.textMuted, marginTop: 2 },

    // Summary card
    summaryCard: {
      margin: 16,
      marginBottom: 8,
      padding: 16,
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    summaryItem: { alignItems: 'center' },
    summaryValue: { fontSize: 20, fontWeight: 'bold', color: c.text },
    summaryLabel: { fontSize: 12, color: c.textMuted, marginTop: 2 },

    // Sale card
    saleCard: {
      marginHorizontal: 16,
      marginBottom: 10,
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      overflow: 'hidden',
    },
    saleCardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
    },
    saleIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: c.primaryMuted,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    saleInfo: { flex: 1 },
    saleDateRow: { flexDirection: 'row', alignItems: 'center' },
    saleDate: { fontSize: 14, fontWeight: '600', color: c.text },
    saleTime: { fontSize: 12, color: c.textMuted, marginLeft: 8 },
    saleCashier: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    saleAmountWrap: { alignItems: 'flex-end' },
    saleAmount: { fontSize: 17, fontWeight: 'bold', color: c.text },
    saleItems: { fontSize: 11, color: c.textMuted, marginTop: 2 },

    // Empty state
    empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    emptyIcon: { marginBottom: 16, opacity: 0.4 },
    emptyTitle: { fontSize: 18, fontWeight: '600', color: c.textMuted },
    emptySub: { fontSize: 14, color: c.placeholder, marginTop: 6, textAlign: 'center' },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalSheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: 8,
      maxHeight: '80%',
    },
    modalHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.border,
      alignSelf: 'center',
      marginBottom: 16,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: c.text },
    modalClose: {
      padding: 6,
      borderRadius: 20,
      backgroundColor: c.backgroundSecondary,
    },
    receiptBody: { padding: 20 },
    receiptRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    receiptLabel: { fontSize: 14, color: c.textMuted },
    receiptValue: { fontSize: 14, fontWeight: '600', color: c.text },
    divider: { height: 1, backgroundColor: c.border, marginVertical: 12 },
    itemsTitle: { fontSize: 15, fontWeight: '700', color: c.text, marginBottom: 10 },
    lineItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    lineItemName: { fontSize: 14, color: c.text, flex: 1 },
    lineItemQty: {
      fontSize: 12,
      color: c.textMuted,
      marginRight: 16,
      backgroundColor: c.backgroundSecondary,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
    },
    lineItemSubtotal: { fontSize: 14, fontWeight: '600', color: c.text },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 16,
      paddingTop: 12,
      borderTopWidth: 2,
      borderTopColor: c.border,
    },
    totalLabel: { fontSize: 16, fontWeight: '700', color: c.text },
    totalValue: { fontSize: 22, fontWeight: 'bold', color: c.primary },
  }));

  const fetchSales = async () => {
    try {
      const response = await api.get('/api/sales/');
      const data: Sale[] = response.data;
      setSales(data);
      const rev = data.reduce((acc, s) => acc + parseFloat(s.grand_total), 0);
      setTotalRevenue(rev);
    } catch (e) {
      console.error('Error fetching sales', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchSales();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchSales();
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const renderSaleCard = ({ item }: { item: Sale }) => (
    <TouchableOpacity style={styles.saleCard} onPress={() => setSelectedSale(item)} activeOpacity={0.75}>
      <View style={styles.saleCardTop}>
        <View style={styles.saleIconWrap}>
          <Ionicons name="receipt-outline" size={20} color={colors.primary} />
        </View>
        <View style={styles.saleInfo}>
          <View style={styles.saleDateRow}>
            <Text style={styles.saleDate}>{formatDate(item.created_at)}</Text>
            <Text style={styles.saleTime}>{formatTime(item.created_at)}</Text>
          </View>
          <Text style={styles.saleCashier}>
            {item.items?.length || 0} item{(item.items?.length || 0) !== 1 ? 's' : ''}
            {item.cashier_name ? ` · ${item.cashier_name}` : ''}
          </Text>
        </View>
        <View style={styles.saleAmountWrap}>
          <Text style={styles.saleAmount}>₦{parseFloat(item.grand_total).toLocaleString()}</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.iconMuted} style={{ marginTop: 4 }} />
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sales History</Text>
        <Text style={styles.headerSub}>{sales.length} transactions recorded</Text>
      </View>

      {/* Summary strip */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{sales.length}</Text>
          <Text style={styles.summaryLabel}>Total Sales</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>₦{totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
          <Text style={styles.summaryLabel}>Total Revenue</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>
            ₦{sales.length > 0 ? (totalRevenue / sales.length).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0'}
          </Text>
          <Text style={styles.summaryLabel}>Avg Sale</Text>
        </View>
      </View>

      {/* List */}
      {sales.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="receipt-outline" size={72} color={colors.iconMuted} style={styles.emptyIcon} />
          <Text style={styles.emptyTitle}>No sales yet</Text>
          <Text style={styles.emptySub}>Complete a checkout from the POS Scanner tab to see sales here.</Text>
        </View>
      ) : (
        <FlatList
          data={sales}
          keyExtractor={(item) => item.id}
          renderItem={renderSaleCard}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          contentContainerStyle={{ paddingTop: 10, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Sale Detail Modal */}
      <Modal
        visible={!!selectedSale}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedSale(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sale Receipt</Text>
              <TouchableOpacity style={styles.modalClose} onPress={() => setSelectedSale(null)}>
                <Ionicons name="close" size={20} color={colors.icon} />
              </TouchableOpacity>
            </View>

            {selectedSale && (
              <ScrollView style={styles.receiptBody} showsVerticalScrollIndicator={false}>
                {/* Meta info */}
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Date</Text>
                  <Text style={styles.receiptValue}>{formatDate(selectedSale.created_at)}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Time</Text>
                  <Text style={styles.receiptValue}>{formatTime(selectedSale.created_at)}</Text>
                </View>
                {selectedSale.cashier_name && (
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>Cashier</Text>
                    <Text style={styles.receiptValue}>{selectedSale.cashier_name}</Text>
                  </View>
                )}
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Sale ID</Text>
                  <Text style={[styles.receiptValue, { fontSize: 11 }]}>{selectedSale.id.substring(0, 13)}…</Text>
                </View>

                <View style={styles.divider} />

                {/* Items */}
                <Text style={styles.itemsTitle}>Items</Text>
                {selectedSale.items?.map((item, idx) => (
                  <View key={idx} style={styles.lineItem}>
                    <Text style={styles.lineItemName} numberOfLines={1}>
                      {item.product_name || `Product #${item.product}`}
                    </Text>
                    <Text style={styles.lineItemQty}>×{item.quantity}</Text>
                    <Text style={styles.lineItemSubtotal}>₦{parseFloat(item.subtotal).toLocaleString()}</Text>
                  </View>
                ))}

                {/* Totals */}
                {parseFloat(selectedSale.discount) > 0 && (
                  <View style={[styles.receiptRow, { marginTop: 12 }]}>
                    <Text style={styles.receiptLabel}>Subtotal</Text>
                    <Text style={styles.receiptValue}>₦{parseFloat(selectedSale.total_amount).toLocaleString()}</Text>
                  </View>
                )}
                {parseFloat(selectedSale.discount) > 0 && (
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>Discount</Text>
                    <Text style={[styles.receiptValue, { color: colors.success }]}>
                      −₦{parseFloat(selectedSale.discount).toLocaleString()}
                    </Text>
                  </View>
                )}
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>₦{parseFloat(selectedSale.grand_total).toLocaleString()}</Text>
                </View>

                {/* Bottom padding for safe area */}
                <View style={{ height: 40 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
