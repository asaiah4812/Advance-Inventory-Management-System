from django.contrib import admin
from .models import Category, Product, Sale, SaleItem

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'description')
    search_fields = ('name',)

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'barcode', 'category', 'price', 'stock_quantity')
    list_filter = ('category',)
    search_fields = ('name', 'barcode')
    list_editable = ('price', 'stock_quantity')

class SaleItemInline(admin.TabularInline):
    model = SaleItem
    extra = 0
    readonly_fields = ('product', 'quantity', 'unit_price', 'subtotal')
    can_delete = False

@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = ('id', 'cashier', 'total_amount', 'discount', 'grand_total', 'created_at')
    list_filter = ('created_at', 'cashier')
    search_fields = ('client_id',)
    inlines = [SaleItemInline]
    readonly_fields = ('client_id', 'total_amount', 'discount', 'grand_total', 'created_at')
    
    def has_add_permission(self, request):
        # Disable manual creation of sales from admin (should be done via POS)
        return False

@admin.register(SaleItem)
class SaleItemAdmin(admin.ModelAdmin):
    list_display = ('sale', 'product', 'quantity', 'unit_price', 'subtotal')
    list_filter = ('product',)
    search_fields = ('sale__client_id', 'product__name')
    
    def has_add_permission(self, request):
        return False
