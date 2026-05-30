from rest_framework import serializers
from .models import Category, Product, Sale, SaleItem
from django.contrib.auth.models import User

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name']

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'

class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.ReadOnlyField(source='category.name')

    class Meta:
        model = Product
        fields = '__all__'

class SaleItemSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    product_barcode = serializers.ReadOnlyField(source='product.barcode')

    class Meta:
        model = SaleItem
        fields = ['id', 'product', 'product_name', 'product_barcode', 'quantity', 'unit_price', 'subtotal']

class SaleSerializer(serializers.ModelSerializer):
    items = SaleItemSerializer(many=True, read_only=True)
    cashier_name = serializers.ReadOnlyField(source='cashier.username')

    class Meta:
        model = Sale
        fields = ['id', 'cashier', 'cashier_name', 'total_amount', 'discount', 'grand_total', 'created_at', 'client_id', 'items']
