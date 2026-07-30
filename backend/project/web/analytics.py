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
    from django.db.models.functions import TruncDate, TruncWeek, TruncMonth
    now = timezone.now()
    labels = []
    values = []

    if period == 'daily':
        start_date = (now - timedelta(days=6)).date()
        daily_totals = qs.filter(created_at__date__gte=start_date).annotate(
            date=TruncDate('created_at')
        ).values('date').annotate(total=Sum('grand_total')).order_by('date')
        
        totals_dict = {item['date']: _decimal(item['total']) for item in daily_totals if item['date']}
        
        for i in range(6, -1, -1):
            day = (now - timedelta(days=i)).date()
            labels.append(day.strftime('%a %d'))
            values.append(totals_dict.get(day, 0.0))
            
    elif period == 'weekly':
        # Fetch daily totals for the last 56 days in one single query
        start_date = (now - timedelta(days=56)).date()
        daily_totals = qs.filter(created_at__date__gte=start_date).annotate(
            date=TruncDate('created_at')
        ).values('date').annotate(total=Sum('grand_total')).order_by('date')
        
        totals_dict = {item['date']: _decimal(item['total']) for item in daily_totals if item['date']}
        
        for i in range(7, -1, -1):
            week_end = (now - timedelta(weeks=i)).date()
            week_start = week_end - timedelta(days=6)
            
            # Aggregate the 7-day range from the cached daily totals in memory
            total = 0.0
            current_day = week_start
            while current_day <= week_end:
                total += totals_dict.get(current_day, 0.0)
                current_day += timedelta(days=1)
                
            labels.append(f"{week_start.strftime('%b %d')}–{week_end.strftime('%d')}")
            values.append(total)
            
    elif period == 'monthly':
        today = now.date()
        start_month_date = (today.replace(day=1) - timedelta(days=365)).replace(day=1)
        
        monthly_totals = qs.filter(created_at__date__gte=start_month_date).annotate(
            month=TruncMonth('created_at')
        ).values('month').annotate(total=Sum('grand_total')).order_by('month')
        
        totals_dict = {(item['month'].year, item['month'].month): _decimal(item['total']) for item in monthly_totals if item['month']}
        
        for i in range(11, -1, -1):
            y = today.year
            m = today.month - i
            while m <= 0:
                m += 12
                y -= 1
            labels.append(date(y, m, 1).strftime('%b %Y'))
            values.append(totals_dict.get((y, m), 0.0))

    return {'labels': labels, 'values': values}


def worker_stats(user):
    if not user.is_superuser:
        return []

    from django.db.models import Q, F
    today = timezone.now().date()
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)

    workers = User.objects.filter(is_staff=True).order_by('username')
    worker_map = {w.id: w for w in workers}
    if not worker_map:
        return []

    stats = Sale.objects.filter(cashier_id__in=worker_map.keys()).values('cashier_id').annotate(
        sales_count=Count('id'),
        total_revenue=Sum('grand_total'),
        daily_revenue=Sum('grand_total', filter=Q(created_at__date=today)),
        weekly_revenue=Sum('grand_total', filter=Q(created_at__date__gte=week_start)),
        monthly_revenue=Sum('grand_total', filter=Q(created_at__date__gte=month_start))
    )

    result_map = {
        w_id: {
            'id': w.id,
            'username': w.username,
            'is_active': w.is_active,
            'is_superuser': w.is_superuser,
            'sales_count': 0,
            'total_revenue': 0.0,
            'daily_revenue': 0.0,
            'weekly_revenue': 0.0,
            'monthly_revenue': 0.0,
        }
        for w_id, w in worker_map.items()
    }

    for stat in stats:
        w_id = stat['cashier_id']
        result_map[w_id].update({
            'sales_count': stat['sales_count'],
            'total_revenue': _decimal(stat['total_revenue']),
            'daily_revenue': _decimal(stat['daily_revenue']),
            'weekly_revenue': _decimal(stat['weekly_revenue']),
            'monthly_revenue': _decimal(stat['monthly_revenue']),
        })

    result = list(result_map.values())
    result.sort(key=lambda w: w['total_revenue'], reverse=True)
    return result


def recent_activity(qs, limit=15):
    sales = qs.order_by('-created_at')[:limit]
    activities = []
    for sale in sales:
        cashier_name = sale.cashier.username if sale.cashier else 'Unknown'
        item_count = len(sale.items.all())
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
    """Stock levels, category breakdown, and health — optimized for DB aggregation."""
    from django.db.models import F, FloatField, ExpressionWrapper, Case, When, Value, IntegerField

    totals = Product.objects.aggregate(
        total_products=Count('id'),
        total_units=Sum('stock_quantity'),
        total_value=Sum(ExpressionWrapper(F('price') * F('stock_quantity'), output_field=FloatField())),
        out_of_stock=Count(Case(When(stock_quantity=0, then=Value(1)), output_field=IntegerField())),
        low_stock=Count(Case(When(stock_quantity__gt=0, stock_quantity__lte=F('low_stock_threshold'), then=Value(1)), output_field=IntegerField())),
        in_stock=Count(Case(When(stock_quantity__gt=F('low_stock_threshold'), then=Value(1)), output_field=IntegerField())),
    )

    cat_stats = Product.objects.values('category__name').annotate(
        units=Sum('stock_quantity'),
        value=Sum(ExpressionWrapper(F('price') * F('stock_quantity'), output_field=FloatField())),
        product_count=Count('id')
    ).order_by('-units')

    by_category = [
        {
            'name': row['category__name'] or 'Uncategorized',
            'units': row['units'] or 0,
            'value': round(row['value'] or 0, 2),
            'product_count': row['product_count'],
        }
        for row in cat_stats
    ]

    top_products = Product.objects.order_by('-stock_quantity')[:10].annotate(
        value=ExpressionWrapper(F('price') * F('stock_quantity'), output_field=FloatField())
    )
    
    top_list = [
        {
            'name': p.name,
            'units': p.stock_quantity,
            'threshold': p.low_stock_threshold,
            'value': round(p.value or 0, 2),
        }
        for p in top_products
    ]

    return {
        'total_products': totals['total_products'] or 0,
        'total_units': totals['total_units'] or 0,
        'total_value': round(totals['total_value'] or 0, 2),
        'stock_health': {
            'labels': ['In stock', 'Low stock', 'Out of stock'],
            'values': [totals['in_stock'] or 0, totals['low_stock'] or 0, totals['out_of_stock'] or 0],
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

    from django.db.models import Q
    summary = qs.aggregate(
        all_time_rev=Sum('grand_total'),
        all_time_cnt=Count('id'),
        today_rev=Sum('grand_total', filter=Q(created_at__date=today)),
        today_cnt=Count('id', filter=Q(created_at__date=today)),
        week_rev=Sum('grand_total', filter=Q(created_at__date__gte=week_start)),
        week_cnt=Count('id', filter=Q(created_at__date__gte=week_start)),
        month_rev=Sum('grand_total', filter=Q(created_at__date__gte=month_start)),
        month_cnt=Count('id', filter=Q(created_at__date__gte=month_start)),
    )

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
            'today': {'revenue': _decimal(summary['today_rev']), 'count': summary['today_cnt'] or 0},
            'week': {'revenue': _decimal(summary['week_rev']), 'count': summary['week_cnt'] or 0},
            'month': {'revenue': _decimal(summary['month_rev']), 'count': summary['month_cnt'] or 0},
            'all_time': {'revenue': _decimal(summary['all_time_rev']), 'count': summary['all_time_cnt'] or 0},
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
    from django.core.cache import cache
    
    cache_key = f'dashboard_payload_{user.id}'
    payload = cache.get(cache_key)
    if payload:
        return payload
        
    from django.db.models import F as DbF

    qs = get_sales_queryset(user)
    today = timezone.now().date()

    from django.db.models import Q
    summary_stats = qs.aggregate(
        revenue=Sum('grand_total'),
        count=Count('id'),
        today_revenue=Sum('grand_total', filter=Q(created_at__date=today)),
        today_count=Count('id', filter=Q(created_at__date=today)),
    )
    low_stock = Product.objects.filter(stock_quantity__lte=DbF('low_stock_threshold')).count()

    payload = {
        'summary': {
            'total_revenue': _decimal(summary_stats['revenue']),
            'total_revenue_display': f"{_decimal(summary_stats['revenue']):,.2f}",
            'sales_count': summary_stats['count'] or 0,
            'today_revenue': _decimal(summary_stats['today_revenue']),
            'today_revenue_display': f"{_decimal(summary_stats['today_revenue']):,.2f}",
            'today_sales_count': summary_stats['today_count'] or 0,
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
    
    # Cache for 5 minutes
    cache.set(cache_key, payload, 300)
    return payload
