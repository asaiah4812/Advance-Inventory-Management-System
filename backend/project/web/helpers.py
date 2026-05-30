"""Shared helpers for web views."""
from django.conf import settings
from django.shortcuts import get_object_or_404
from django.utils import timezone

from api.models import Sale


def get_sales_queryset(user):
    qs = Sale.objects.select_related('cashier').prefetch_related('items__product')
    if user.is_superuser:
        return qs
    return qs.filter(cashier=user)


def get_sale_for_user(user, sale_id):
    return get_object_or_404(get_sales_queryset(user), pk=sale_id)


def build_receipt_context(sale):
    items = []
    for item in sale.items.select_related('product').all():
        items.append({
            'name': item.product.name,
            'barcode': item.product.barcode,
            'quantity': item.quantity,
            'unit_price': item.unit_price,
            'subtotal': item.subtotal,
        })

    created = timezone.localtime(sale.created_at)
    return {
        'sale': sale,
        'items': items,
        'receipt_no': str(sale.id)[:8].upper(),
        'sale_date': created.strftime('%d %b %Y'),
        'sale_time': created.strftime('%I:%M %p'),
        'cashier_name': sale.cashier.username if sale.cashier else '—',
        'store_name': getattr(settings, 'STORE_NAME', 'InventoryPro'),
        'store_address': getattr(settings, 'STORE_ADDRESS', ''),
        'store_phone': getattr(settings, 'STORE_PHONE', ''),
    }
