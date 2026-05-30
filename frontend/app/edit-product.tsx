import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { createFormStyles } from '../constants/formStyles';

export default function EditProductScreen() {
  const params = useLocalSearchParams();
  const productId = params.id;
  const { colors } = useTheme();
  const styles = useMemo(() => createFormStyles(colors), [colors]);

  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('0');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [isCategoryModalVisible, setCategoryModalVisible] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!productId) return;
    const fetchData = async () => {
      try {
        const [categoriesRes, productRes] = await Promise.all([
          api.get('/api/categories/'),
          api.get(`/api/products/${productId}/`),
        ]);
        setCategories(categoriesRes.data);
        const p = productRes.data;
        setName(p.name);
        setBarcode(p.barcode);
        setPrice(parseFloat(p.price).toString());
        setStock(p.stock_quantity.toString());
        setCategoryId(p.category);
        if (p.image) setImageUri(p.image);
      } catch {
        Alert.alert('Error', 'Failed to load product.');
        router.back();
      } finally {
        setFetching(false);
      }
    };
    fetchData();
  }, [productId]);

  const chooseImageSource = () => {
    Alert.alert('Select Image', 'Choose a source', [
      { text: 'Take Photo', onPress: takePhoto },
      { text: 'Gallery', onPress: pickImage },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const handleUpdate = async () => {
    if (!name || !barcode || !price) {
      Alert.alert('Error', 'Please fill required fields');
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('barcode', barcode);
      formData.append('price', price);
      formData.append('stock_quantity', stock);
      formData.append('category', categoryId ? categoryId.toString() : '');
      if (imageUri && (imageUri.startsWith('file://') || imageUri.startsWith('content://'))) {
        const filename = imageUri.split('/').pop() || 'photo.jpg';
        const match = /\.(\w+)$/.exec(filename);
        formData.append('image', { uri: imageUri, name: filename, type: match ? `image/${match[1]}` : 'image' } as any);
      }
      await api.put(`/api/products/${productId}/`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      Alert.alert('Success', 'Product updated!', [{ text: 'OK', onPress: () => router.back() }]);
    } catch {
      Alert.alert('Error', 'Failed to update product.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Product', `Delete "${name}" permanently?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            await api.delete(`/api/products/${productId}/`);
            Alert.alert('Deleted', 'Product removed.', [{ text: 'OK', onPress: () => router.back() }]);
          } catch {
            Alert.alert('Error', 'Failed to delete.');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  if (fetching) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading product...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="close" size={24} color={colors.icon} />
        </TouchableOpacity>
        <Text style={styles.title}>Edit Product</Text>
        <TouchableOpacity onPress={handleDelete} style={styles.deleteHeaderButton}>
          <Ionicons name="trash-outline" size={24} color={colors.danger} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.imagePicker} onPress={chooseImageSource}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.image} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="camera-outline" size={40} color={colors.iconMuted} />
            <Text style={styles.imageText}>Tap to change photo</Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Product Name *</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={colors.placeholder} />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Category</Text>
        <TouchableOpacity style={styles.input} onPress={() => setCategoryModalVisible(true)}>
          <Text style={{ color: categoryId ? colors.text : colors.placeholder }}>
            {categoryId ? categories.find((c) => c.id === categoryId)?.name || 'Select' : 'Select Category'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Barcode *</Text>
        <TextInput style={styles.input} value={barcode} onChangeText={setBarcode} placeholderTextColor={colors.placeholder} />
      </View>

      <View style={styles.row}>
        <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
          <Text style={styles.label}>Price (₦) *</Text>
          <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholderTextColor={colors.placeholder} />
        </View>
        <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
          <Text style={styles.label}>Stock</Text>
          <TextInput style={styles.input} value={stock} onChangeText={setStock} keyboardType="number-pad" placeholderTextColor={colors.placeholder} />
        </View>
      </View>

      <TouchableOpacity style={[styles.saveButton, loading && styles.saveButtonDisabled]} onPress={handleUpdate} disabled={loading}>
        {loading ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
      </TouchableOpacity>

      <Modal visible={isCategoryModalVisible} transparent animationType="slide" onRequestClose={() => setCategoryModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Category</Text>
              <TouchableOpacity onPress={() => setCategoryModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.icon} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={categories}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setCategoryId(item.id);
                    setCategoryModalVisible(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{item.name}</Text>
                  {categoryId === item.id && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.modalEmpty}>No categories</Text>}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
