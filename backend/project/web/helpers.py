"""Shared helpers for web views."""
import base64
import io
import json
import socket

import qrcode
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


def get_local_lan_ip():
    """Best-effort LAN IPv4 for mobile devices on the same Wi-Fi."""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(0.5)
        sock.connect(('8.8.8.8', 80))
        ip = sock.getsockname()[0]
        sock.close()
        return ip
    except OSError:
        return None


def get_online_api_url(request):
    """Public HTTPS URL for hosted deployments."""
    configured = getattr(settings, 'PUBLIC_API_URL', '').strip().rstrip('/')
    if configured:
        return configured
    host = request.get_host().split(':')[0]
    if host in ('localhost', '127.0.0.1'):
        return f'http://{request.get_host()}'.rstrip('/')
    scheme = 'https' if request.is_secure() else ('https' if not settings.DEBUG else 'http')
    return f'{scheme}://{request.get_host()}'.rstrip('/')


def get_mobile_api_urls(request):
    port = str(getattr(settings, 'MOBILE_API_PORT', 8000))
    local_ip = get_local_lan_ip()
    if local_ip:
        local_url = f'http://{local_ip}:{port}'
    else:
        local_url = f'http://127.0.0.1:{port}'
    return {
        'local_url': local_url,
        'online_url': get_online_api_url(request),
        'local_ip': local_ip,
    }


def mobile_qr_payload(mode: str, url: str) -> str:
    return json.dumps({'v': 1, 'app': 'inventorypro', 'mode': mode, 'url': url})


def qr_data_uri(payload: str) -> str:
    qr = qrcode.QRCode(version=1, box_size=8, border=2)
    qr.add_data(payload)
    qr.make(fit=True)
    img = qr.make_image(fill_color='#0f172a', back_color='white')
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    b64 = base64.b64encode(buf.getvalue()).decode('ascii')
    return f'data:image/png;base64,{b64}'


def get_mobile_connect_context(request):
    urls = get_mobile_api_urls(request)
    local_payload = mobile_qr_payload('local', urls['local_url'])
    online_payload = mobile_qr_payload('online', urls['online_url'])
    return {
        **urls,
        'local_qr': qr_data_uri(local_payload),
        'online_qr': qr_data_uri(online_payload),
        'local_payload': local_payload,
        'online_payload': online_payload,
    }


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
