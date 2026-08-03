"""
Dashboard analytics helpers — earnings series and per-worker activity.
"""
from datetime import date, timedelta
from django.contrib.auth.models import User
from django.db.models import Count, Sum
from django.utils import timezone

from api.models import Product, Sale, SaleItem


def _decimal(value):
    if value is None:
        return 0.0
    return float(value)


def get_sales_queryset(user):
    if user.is_superuser:
        return Sale.objects.select_related('cashier').prefetch_related('items')
    return Sale.objects.filter(cashier=user).select_related('cashier').prefetch_related('items')


def earnings_series(qs, period='daily'):
    now = timezone.now()
    labels = []
    values = []

    if period == 'daily':
        for i in range(6, -1, -1):
            day = (now - timedelta(days=i)).date()
            total = qs.filter(created_at__date=day).aggregate(s=Sum('grand_total'))['s']
            labels.append(day.strftime('%a %d'))
            values.append(_decimal(total))
    elif period == 'weekly':
        for i in range(7, -1, -1):
            week_end = (now - timedelta(weeks=i)).date()
            week_start = week_end - timedelta(days=6)
            total = qs.filter(
                created_at__date__gte=week_start,
                created_at__date__lte=week_end,
            ).aggregate(s=Sum('grand_total'))['s']
            labels.append(f"{week_start.strftime('%b %d')}–{week_end.strftime('%d')}")
            values.append(_decimal(total))
    elif period == 'monthly':
        today = now.date()
        for i in range(11, -1, -1):
            y = today.year
            m = today.month - i
            while m <= 0:
                m += 12
                y -= 1
            month_start = date(y, m, 1)
            if m == 12:
                month_end = date(y + 1, 1, 1)
            else:
                month_end = date(y, m + 1, 1)
            total = qs.filter(
                created_at__date__gte=month_start,
                created_at__date__lt=month_end,
            ).aggregate(s=Sum('grand_total'))['s']
            labels.append(month_start.strftime('%b %Y'))
            values.append(_decimal(total))

    return {'labels': labels, 'values': values}


def worker_stats(user):
    if not user.is_superuser:
        return []

    today = timezone.now().date()
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)

    workers = User.objects.filter(is_staff=True).order_by('username')
    result = []

    for worker in workers:
        w_qs = Sale.objects.filter(cashier=worker)
        total_rev = w_qs.aggregate(s=Sum('grand_total'))['s']
        result.append({
            'id': worker.id,
            'username': worker.username,
            'is_active': worker.is_active,
            'is_superuser': worker.is_superuser,
            'sales_count': w_qs.count(),
            'total_revenue': _decimal(total_rev),
            'daily_revenue': _decimal(
                w_qs.filter(created_at__date=today).aggregate(s=Sum('grand_total'))['s']
            ),
            'weekly_revenue': _decimal(
                w_qs.filter(created_at__date__gte=week_start).aggregate(s=Sum('grand_total'))['s']
            ),
            'monthly_revenue': _decimal(
                w_qs.filter(created_at__date__gte=month_start).aggregate(s=Sum('grand_total'))['s']
            ),
        })

    result.sort(key=lambda w: w['total_revenue'], reverse=True)
    return result


def recent_activity(qs, limit=15):
    sales = qs.order_by('-created_at')[:limit]
    activities = []
    for sale in sales:
        cashier_name = sale.cashier.username if sale.cashier else 'Unknown'
        item_count = sale.items.count()
        activities.append({
            'sale_id': str(sale.id),
            'cashier': cashier_name,
            'amount': _decimal(sale.grand_total),
            'items_count': item_count,
            'created_at': sale.created_at.isoformat(),
            'time_display': timezone.localtime(sale.created_at).strftime('%H:%M:%S'),
            'date_display': timezone.localtime(sale.created_at).strftime('%b %d, %Y'),
        })
    return activities


def inventory_stats():
    """Stock levels, category breakdown, and health — for dashboard Chart.js widgets."""
    products = list(
        Product.objects.select_related('category').only(
            'name', 'price', 'stock_quantity', 'low_stock_threshold', 'category__name'
        )
    )

    total_products = len(products)
    total_units = sum(p.stock_quantity for p in products)
    total_value = sum(float(p.price) * p.stock_quantity for p in products)

    out_of_stock = sum(1 for p in products if p.stock_quantity == 0)
    low_stock = sum(
        1 for p in products if 0 < p.stock_quantity <= p.low_stock_threshold
    )
    in_stock = sum(1 for p in products if p.stock_quantity > p.low_stock_threshold)

    cat_map = {}
    for p in products:
        cname = p.category.name if p.category else 'Uncategorized'
        if cname not in cat_map:
            cat_map[cname] = {'units': 0, 'value': 0.0, 'product_count': 0}
        cat_map[cname]['units'] += p.stock_quantity
        cat_map[cname]['value'] += float(p.price) * p.stock_quantity
        cat_map[cname]['product_count'] += 1

    by_category = sorted(
        [
            {
                'name': name,
                'units': row['units'],
                'value': round(row['value'], 2),
                'product_count': row['product_count'],
            }
            for name, row in cat_map.items()
        ],
        key=lambda x: x['units'],
        reverse=True,
    )

    top_list = [
        {
            'name': p.name,
            'units': p.stock_quantity,
            'threshold': p.low_stock_threshold,
            'value': round(float(p.price) * p.stock_quantity, 2),
        }
        for p in sorted(products, key=lambda p: p.stock_quantity, reverse=True)[:10]
    ]

    return {
        'total_products': total_products,
        'total_units': total_units,
        'total_value': round(total_value, 2),
        'stock_health': {
            'labels': ['In stock', 'Low stock', 'Out of stock'],
            'values': [in_stock, low_stock, out_of_stock],
        },
        'by_category': by_category,
        'top_products': top_list,
    }


def get_reports_context(user):
    """Full analytics payload for the Reports page."""
    from django.db.models import F as DbF

    qs = get_sales_queryset(user)
    today = timezone.now().date()
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)

    def _period_stats(q):
        return {
            'revenue': _decimal(q.aggregate(s=Sum('grand_total'))['s']),
            'count': q.count(),
        }

    daily_series = earnings_series(qs, 'daily')
    weekly_series = earnings_series(qs, 'weekly')
    monthly_series = earnings_series(qs, 'monthly')

    top_rows = list(
        SaleItem.objects.filter(sale__in=qs)
        .values('product__name', 'product__barcode', 'product__category__name')
        .annotate(qty=Sum('quantity'), revenue=Sum('subtotal'))
        .order_by('-revenue')[:15]
    )
    total_top_rev = sum(_decimal(r['revenue']) for r in top_rows) or 0
    top_products = []
    for r in top_rows:
        rev = _decimal(r['revenue'])
        top_products.append({
            'name': r['product__name'] or '—',
            'barcode': r['product__barcode'] or '—',
            'category': r['product__category__name'] or 'Uncategorized',
            'qty': r['qty'] or 0,
            'revenue': rev,
            'share': round((rev / total_top_rev * 100), 1) if total_top_rev else 0,
        })

    workers = worker_stats(user) if user.is_superuser else []

    low_stock_products = list(
        Product.objects.filter(stock_quantity__lte=DbF('low_stock_threshold'))
        .select_related('category')
        .order_by('stock_quantity', 'name')[:12]
        .values('name', 'barcode', 'stock_quantity', 'low_stock_threshold', 'category__name', 'price')
    )

    def breakdown_table(series):
        rows = []
        for i, label in enumerate(series.get('labels', [])):
            val = _decimal(series['values'][i] if i < len(series.get('values', [])) else 0)
            rows.append({'label': label, 'revenue': val})
        rows.sort(key=lambda x: x['revenue'], reverse=True)
        return rows

    inventory = inventory_stats()

    return {
        'summary': {
            'today': _period_stats(qs.filter(created_at__date=today)),
            'week': _period_stats(qs.filter(created_at__date__gte=week_start)),
            'month': _period_stats(qs.filter(created_at__date__gte=month_start)),
            'all_time': _period_stats(qs),
        },
        'earnings': {
            'daily': daily_series,
            'weekly': weekly_series,
            'monthly': monthly_series,
        },
        'daily_breakdown': breakdown_table(daily_series),
        'weekly_breakdown': breakdown_table(weekly_series),
        'monthly_breakdown': breakdown_table(monthly_series),
        'top_products': top_products,
        'workers': workers,
        'inventory': inventory,
        'low_stock_products': [
            {
                'name': p['name'],
                'barcode': p['barcode'],
                'stock_quantity': p['stock_quantity'],
                'low_stock_threshold': p['low_stock_threshold'],
                'category': p['category__name'] or '—',
                'value': round(float(p['price']) * p['stock_quantity'], 2),
            }
            for p in low_stock_products
        ],
        'generated_at': timezone.localtime(timezone.now()).strftime('%b %d, %Y · %H:%M'),
    }


def get_dashboard_payload(user):
    from django.db.models import F as DbF

    qs = get_sales_queryset(user)
    today = timezone.now().date()

    totals = qs.aggregate(
        revenue=Sum('grand_total'),
        count=Count('id'),
    )
    today_stats = qs.filter(created_at__date=today).aggregate(
        revenue=Sum('grand_total'),
        count=Count('id'),
    )
    low_stock = Product.objects.filter(stock_quantity__lte=DbF('low_stock_threshold')).count()

    return {
        'summary': {
            'total_revenue': _decimal(totals['revenue']),
            'total_revenue_display': f"{_decimal(totals['revenue']):,.2f}",
            'sales_count': totals['count'] or 0,
            'today_revenue': _decimal(today_stats['revenue']),
            'today_revenue_display': f"{_decimal(today_stats['revenue']):,.2f}",
            'today_sales_count': today_stats['count'] or 0,
            'low_stock': low_stock,
        },
        'earnings': {
            'daily': earnings_series(qs, 'daily'),
            'weekly': earnings_series(qs, 'weekly'),
            'monthly': earnings_series(qs, 'monthly'),
        },
        'workers': worker_stats(user),
        'recent_activity': recent_activity(qs),
        'inventory': inventory_stats(),
        'is_manager': user.is_superuser,
        'updated_at': timezone.now().isoformat(),
    }
