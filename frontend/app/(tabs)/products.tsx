import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import api from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';

export default function ProductsScreen() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { colors } = useTheme();

  const styles = useThemedStyles((c) => ({
    container: { flex: 1, backgroundColor: c.background },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.background },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      backgroundColor: c.surface,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    title: { fontSize: 24, fontWeight: 'bold', color: c.text },
    subtitle: { fontSize: 14, color: c.textMuted },
    addButton: {
      backgroundColor: c.primary,
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
    },
    listContainer: { padding: 16 },
    productCard: {
      backgroundColor: c.surface,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: c.border,
    },
    productImage: { width: 50, height: 50, borderRadius: 8, marginRight: 12, backgroundColor: c.backgroundSecondary },
    productImagePlaceholder: {
      width: 50,
      height: 50,
      borderRadius: 8,
      marginRight: 12,
      backgroundColor: c.backgroundSecondary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: c.border,
    },
    productInfo: { flex: 1 },
    productName: { fontSize: 16, fontWeight: '600', color: c.text },
    productCategory: { fontSize: 12, color: c.primary, marginTop: 2, fontWeight: '500' },
    barcodeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    productBarcode: { fontSize: 12, color: c.textMuted, marginLeft: 4 },
    productStats: { alignItems: 'flex-end' },
    productPrice: { fontSize: 16, fontWeight: 'bold', color: c.text },
    stockBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginTop: 8 },
    stockBadgeOk: { backgroundColor: c.successMuted },
    stockBadgeLow: { backgroundColor: c.dangerMuted },
    stockText: { fontSize: 12, fontWeight: '500' },
    stockTextOk: { color: c.success },
    stockTextLow: { color: c.danger },
  }));

  const fetchProducts = async () => {
    try {
      const response = await api.get('/api/products/');
      setProducts(response.data);
    } catch (e) {
      console.log('Error fetching products', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchProducts();
    }, [])
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Inventory</Text>
          <Text style={styles.subtitle}>{products.length} items total</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => router.push('/add-product')}>
          <Ionicons name="add" size={26} color={colors.iconOnPrimary} />
        </TouchableOpacity>
      </View>
      <FlatList
        data={products}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchProducts(); }} tintColor={colors.primary} />
        }
        contentContainerStyle={styles.listContainer}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.productCard}
            onPress={() => router.push({ pathname: '/edit-product', params: { id: item.id } })}
          >
            {item.image ? (
              <Image source={{ uri: item.image }} style={styles.productImage} />
            ) : (
              <View style={styles.productImagePlaceholder}>
                <Ionicons name="image-outline" size={24} color={colors.iconMuted} />
              </View>
            )}
            <View style={styles.productInfo}>
              <Text style={styles.productName}>{item.name}</Text>
              {item.category_name && <Text style={styles.productCategory}>{item.category_name}</Text>}
              <View style={styles.barcodeRow}>
                <Ionicons name="barcode-outline" size={14} color={colors.iconMuted} />
                <Text style={styles.productBarcode}>{item.barcode}</Text>
              </View>
            </View>
            <View style={styles.productStats}>
              <Text style={styles.productPrice}>₦{parseFloat(item.price).toFixed(2)}</Text>
              <View
                style={[
                  styles.stockBadge,
                  item.stock_quantity <= 5 ? styles.stockBadgeLow : styles.stockBadgeOk,
                ]}
              >
                <Text
                  style={[
                    styles.stockText,
                    item.stock_quantity <= 5 ? styles.stockTextLow : styles.stockTextOk,
                  ]}
                >
                  {item.stock_quantity} left
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
