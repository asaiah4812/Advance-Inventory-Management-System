"""
Dashboard analytics helpers — earnings series and per-worker activity.
"""
from datetime import date, timedelta
from django.contrib.auth.models import User
from django.db.models import Count, Sum
from django.utils import timezone

from api.models import Product, Sale


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
        'is_manager': user.is_superuser,
        'updated_at': timezone.now().isoformat(),
    }
