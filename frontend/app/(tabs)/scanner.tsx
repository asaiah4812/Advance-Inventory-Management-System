import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { router, useIsFocused } from 'expo-router';
import * as Print from 'expo-print';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SyncService } from '../../services/sync';
import api from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';

const BARCODE_TYPES = ['qr', 'ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'] as const;

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [cart, setCart] = useState<any[]>([]);
  const [scanMode, setScanMode] = useState<'camera' | 'gun'>('gun');
  const [cameraReady, setCameraReady] = useState(false);
  const [isFullscreenCamera, setIsFullscreenCamera] = useState(false);
  const [gunInput, setGunInput] = useState('');
  const gunInputRef = useRef<TextInput>(null);
  const { colors } = useTheme();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();

  const styles = useThemedStyles((c) => ({
    container: { flex: 1, backgroundColor: c.background },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
      backgroundColor: c.background,
    },
    message: { textAlign: 'center', fontSize: 16, marginBottom: 20, color: c.textSecondary },
    actionButton: { backgroundColor: c.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
    actionButtonText: { color: c.onPrimary, fontWeight: '600', fontSize: 16 },
    cameraContainer: { flex: 1, backgroundColor: '#000' },
    cameraPanel: {
      height: 280,
      backgroundColor: '#000',
      overflow: 'hidden',
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    closeCamera: { position: 'absolute', top: 12, right: 12, zIndex: 10 },
    expandCamera: { position: 'absolute', top: 12, left: 12, zIndex: 10 },
    scanOverlay: {
      ...StyleSheet.absoluteFill,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.35)',
    },
    scanBox: {
      width: 250,
      height: 150,
      borderWidth: 2,
      borderColor: c.success,
      backgroundColor: 'transparent',
      borderRadius: 12,
    },
    scanText: { color: '#ffffff', marginTop: 20, fontSize: 16, fontWeight: '500' },
    cartHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      backgroundColor: c.surface,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    cartTitle: { fontSize: 20, fontWeight: 'bold', color: c.text },
    scanButton: {
      backgroundColor: c.success,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
    },
    scanButtonText: { color: c.onPrimary, fontWeight: '600', marginLeft: 8 },
    emptyCart: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyCartText: { fontSize: 18, fontWeight: '600', color: c.textMuted, marginTop: 16 },
    emptyCartSub: { fontSize: 14, color: c.placeholder, marginTop: 4 },
    cartItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: c.surface,
      padding: 16,
      marginHorizontal: 16,
      marginTop: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
    },
    itemInfo: { flex: 1, marginRight: 10 },
    itemName: { fontSize: 16, fontWeight: '600', color: c.text },
    itemPrice: { fontSize: 14, color: c.textMuted, marginTop: 4 },
    itemRight: { alignItems: 'flex-end', justifyContent: 'center' },
    itemSubtotal: { fontSize: 18, fontWeight: 'bold', color: c.text, marginBottom: 8 },
    qtyControl: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.inputBackground, borderRadius: 8, padding: 4 },
    qtyBtn: { padding: 4, backgroundColor: c.surface, borderRadius: 6, borderWidth: 1, borderColor: c.border },
    qtyText: { marginHorizontal: 12, fontSize: 16, fontWeight: 'bold', color: c.text },
    removeBtn: { marginLeft: 12, padding: 4 },
    checkoutFooter: {
      backgroundColor: c.surface,
      padding: 20,
      borderTopWidth: 1,
      borderTopColor: c.border,
      paddingBottom: 40,
    },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    totalLabel: { fontSize: 18, color: c.textMuted },
    totalValue: { fontSize: 28, fontWeight: 'bold', color: c.text },
    checkoutButton: { backgroundColor: c.primary, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
    checkoutButtonDisabled: { backgroundColor: c.border },
    checkoutButtonText: { color: c.onPrimary, fontSize: 18, fontWeight: 'bold' },
    modeRow: {
      flexDirection: 'row',
      padding: 12,
      backgroundColor: c.surface,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    modeBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: c.border,
      marginHorizontal: 4,
    },
    modeBtnActive: { backgroundColor: c.primary, borderColor: c.primary },
    modeBtnText: { fontSize: 13, fontWeight: '600', color: c.textMuted },
    modeBtnTextActive: { color: c.onPrimary },
    gunPanel: {
      padding: 16,
      backgroundColor: c.surface,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    gunInput: {
      borderWidth: 2,
      borderColor: c.success,
      borderRadius: 12,
      padding: 14,
      fontSize: 16,
      fontFamily: 'monospace',
      color: c.text,
      backgroundColor: c.inputBackground,
    },
    gunHint: { fontSize: 12, color: c.textMuted, marginTop: 8, textAlign: 'center' },
    permissionBox: {
      padding: 20,
      backgroundColor: c.surface,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      alignItems: 'center',
    },
    permissionText: { fontSize: 14, color: c.textSecondary, textAlign: 'center', marginBottom: 12 },
  }));

  const showCamera = scanMode === 'camera' && permission?.granted && isFocused && cameraReady;

  useEffect(() => {
    if (scanMode === 'gun') {
      setIsFullscreenCamera(false);
      const t = setTimeout(() => gunInputRef.current?.focus(), 300);
      return () => clearTimeout(t);
    }
  }, [scanMode]);

  useEffect(() => {
    if (scanMode !== 'camera' || !permission?.granted) {
      setCameraReady(false);
      return;
    }
    const t = setTimeout(() => setCameraReady(true), 150);
    return () => {
      clearTimeout(t);
      setCameraReady(false);
    };
  }, [scanMode, permission?.granted, isFocused]);

  const ensureCameraPermission = useCallback(async () => {
    if (permission?.granted) return true;
    const result = await requestPermission();
    if (!result.granted) {
      Alert.alert(
        'Camera permission required',
        'Allow camera access in Settings to scan barcodes with your phone camera, or use Scanner gun mode.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  }, [permission?.granted, requestPermission]);

  const switchToCameraMode = async () => {
    const ok = await ensureCameraPermission();
    if (ok) {
      setScanned(false);
      setScanMode('camera');
    }
  };

  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.message, { marginTop: 16 }]}>Checking camera access…</Text>
      </View>
    );
  }

  const lookupBarcode = async (barcodeStr: string) => {
    if (!barcodeStr) {
      Alert.alert('Error', 'Invalid or empty barcode.');
      return;
    }
    try {
      let product = null;
      try {
        const response = await api.get(`/api/products/?barcode=${encodeURIComponent(barcodeStr)}`);
        if (response.data?.length > 0) {
          product = response.data.find((p: any) => p.barcode === barcodeStr);
        }
      } catch {
        console.log('Could not fetch from API');
      }
      if (product) {
        addToCart(product);
      } else {
        Alert.alert('Product Not Registered', `Barcode "${barcodeStr}" not found.\n\nAdd it now?`, [
          { text: 'Add Product', onPress: () => router.push({ pathname: '/add-product', params: { barcode: barcodeStr } }) },
          { text: 'Cancel', style: 'cancel' },
        ]);
      }
    } catch {
      Alert.alert('Error', 'Failed to process barcode');
    }
  };

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    await lookupBarcode(data ? data.trim() : '');
    setTimeout(() => setScanned(false), 1500);
  };

  const handleGunSubmit = async () => {
    const code = gunInput.replace(/[\r\n\t]+/g, '').trim();
    setGunInput('');
    await lookupBarcode(code);
    gunInputRef.current?.focus();
  };

  const addToCart = (product: any) => {
    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.product_id === product.id);
      if (existing) {
        return prevCart.map((item) =>
          item.product_id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                subtotal: ((item.quantity + 1) * item.unit_price).toFixed(2),
              }
            : item
        );
      }
      return [
        ...prevCart,
        {
          product_id: product.id,
          name: product.name,
          quantity: 1,
          unit_price: parseFloat(product.price),
          subtotal: parseFloat(product.price).toFixed(2),
        },
      ];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prevCart) => {
      return prevCart.map((item) => {
        if (item.product_id === productId) {
          const newQty = Math.max(1, item.quantity + delta);
          return {
            ...item,
            quantity: newQty,
            subtotal: (newQty * item.unit_price).toFixed(2),
          };
        }
        return item;
      });
    });
  };

  const removeItem = (productId: string) => {
    setCart((prevCart) => prevCart.filter(item => item.product_id !== productId));
  };

  const calculateTotal = () =>
    cart.reduce((total, item) => total + parseFloat(item.subtotal), 0).toFixed(2);

  const printReceipt = async (items: any[], total: string) => {
    const html = `
      <html>
        <head>
          <style>
            body { font-family: monospace; font-size: 14px; margin: 0; padding: 10px; }
            h1 { text-align: center; font-size: 20px; margin-bottom: 5px; }
            .divider { border-bottom: 1px dashed #000; margin: 10px 0; }
            .item { display: flex; justify-content: space-between; margin-bottom: 5px; }
            .total { display: flex; justify-content: space-between; font-weight: bold; font-size: 16px; margin-top: 10px; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; }
          </style>
        </head>
        <body>
          <h1>InventoryPro POS</h1>
          <div class="divider"></div>
          ${items.map(item => `
            <div class="item">
              <div>${item.name}<br><small>${item.quantity} x NGN ${item.unit_price.toFixed(2)}</small></div>
              <div>NGN ${parseFloat(item.subtotal).toFixed(2)}</div>
            </div>
          `).join('')}
          <div class="divider"></div>
          <div class="total">
            <span>TOTAL:</span>
            <span>NGN ${total}</span>
          </div>
          <div class="footer">Thank you for your purchase!</div>
        </body>
      </html>
    `;
    try {
      await Print.printAsync({ html });
    } catch (err) {
      console.error(err);
      Alert.alert('Print Error', 'Could not print the receipt.');
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    const total = calculateTotal();
    const saleData = { total_amount: total, discount: 0, grand_total: total, items: cart };
    const savedCart = [...cart];
    try {
      const result = await SyncService.submitSale(saleData);
      setCart([]);
      Alert.alert(
        'Checkout Successful',
        result.ok ? 'Sale recorded!' : 'Sale saved offline — sync from Dashboard when online.',
        [
          { text: 'Print Receipt', onPress: () => printReceipt(savedCart, total) },
          { text: 'OK', style: 'cancel' }
        ]
      );
    } catch {
      Alert.alert('Error', 'Could not complete checkout');
    }
  };

  const renderCamera = (fullscreen: boolean) => (
    <View style={fullscreen ? styles.cameraContainer : styles.cameraPanel}>
      {showCamera ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          mute
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.centerContainer]}>
          <ActivityIndicator size="large" color="#ffffff" />
        </View>
      )}
      <TouchableOpacity
        style={[styles.expandCamera, fullscreen ? { top: insets.top + 8 } : undefined]}
        onPress={() => (fullscreen ? setIsFullscreenCamera(false) : setIsFullscreenCamera(true))}
      >
        <Ionicons name={fullscreen ? 'contract-outline' : 'expand-outline'} size={28} color="#ffffff" />
      </TouchableOpacity>
      {fullscreen && (
        <TouchableOpacity
          style={[styles.closeCamera, { top: insets.top + 8 }]}
          onPress={() => setIsFullscreenCamera(false)}
        >
          <Ionicons name="close-circle" size={40} color="#ffffff" />
        </TouchableOpacity>
      )}
      <View style={styles.scanOverlay} pointerEvents="none">
        <View style={styles.scanBox} />
        <Text style={styles.scanText}>Align barcode within the frame</Text>
      </View>
    </View>
  );

  if (isFullscreenCamera && scanMode === 'camera') {
    return <View style={styles.container}>{renderCamera(true)}</View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeBtn, scanMode === 'gun' && styles.modeBtnActive]}
          onPress={() => setScanMode('gun')}
        >
          <Text style={[styles.modeBtnText, scanMode === 'gun' && styles.modeBtnTextActive]}>Scanner gun</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, scanMode === 'camera' && styles.modeBtnActive]}
          onPress={switchToCameraMode}
        >
          <Text style={[styles.modeBtnText, scanMode === 'camera' && styles.modeBtnTextActive]}>Camera</Text>
        </TouchableOpacity>
      </View>

      {scanMode === 'gun' ? (
        <View style={styles.gunPanel}>
          <TextInput
            ref={gunInputRef}
            style={styles.gunInput}
            value={gunInput}
            onChangeText={setGunInput}
            onSubmitEditing={handleGunSubmit}
            placeholder="Tap here, then scan with barcode gun..."
            placeholderTextColor={colors.placeholder}
            autoCapitalize="none"
            autoCorrect={false}
            blurOnSubmit={false}
            showSoftInputOnFocus={false}
          />
          <Text style={styles.gunHint}>
            USB/Bluetooth scanners that act as a keyboard work here. Scan sends Enter automatically.
          </Text>
        </View>
      ) : !permission.granted ? (
        <View style={styles.permissionBox}>
          <Ionicons name="camera-outline" size={40} color={colors.iconMuted} />
          <Text style={styles.permissionText}>Camera access is needed to scan barcodes with your phone.</Text>
          <TouchableOpacity style={styles.actionButton} onPress={ensureCameraPermission}>
            <Text style={styles.actionButtonText}>Allow camera</Text>
          </TouchableOpacity>
        </View>
      ) : (
        renderCamera(false)
      )}

      <View style={styles.cartHeader}>
        <Text style={styles.cartTitle}>Current Sale</Text>
      </View>
      {cart.length === 0 ? (
        <View style={styles.emptyCart}>
          <Ionicons name="cart-outline" size={64} color={colors.iconMuted} />
          <Text style={styles.emptyCartText}>Cart is empty</Text>
          <Text style={styles.emptyCartSub}>
            {scanMode === 'camera' ? 'Point the camera at a barcode' : 'Scan a product to begin'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={cart}
          keyExtractor={(item, index) => `${item.product_id}-${index}`}
          renderItem={({ item }) => (
            <View style={styles.cartItem}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemPrice}>₦{item.unit_price.toFixed(2)}</Text>
              </View>
              <View style={styles.itemRight}>
                <Text style={styles.itemSubtotal}>₦{parseFloat(item.subtotal).toFixed(2)}</Text>
                <View style={styles.qtyControl}>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(item.product_id, -1)}>
                    <Ionicons name="remove" size={16} color={colors.text} />
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{item.quantity}</Text>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(item.product_id, 1)}>
                    <Ionicons name="add" size={16} color={colors.text} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.removeBtn} onPress={() => removeItem(item.product_id)}>
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        />
      )}
      <View style={styles.checkoutFooter}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>₦{calculateTotal()}</Text>
        </View>
        <TouchableOpacity
          style={[styles.checkoutButton, cart.length === 0 && styles.checkoutButtonDisabled]}
          onPress={handleCheckout}
          disabled={cart.length === 0}
        >
          <Text style={styles.checkoutButtonText}>Complete Checkout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
