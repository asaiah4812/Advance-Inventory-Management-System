from datetime import datetime

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.http import HttpResponse
from django.shortcuts import redirect, render
from django.utils import timezone

from api.models import Product, Sale
from api.realtime import broadcast_dashboard_update

from .decorators import manager_required
from .excel_io import (
    build_products_template_workbook,
    build_products_workbook,
    build_sales_template_workbook,
    build_sales_workbook,
    import_products_from_file,
    import_sales_from_file,
    workbook_to_bytes,
)
from .helpers import get_sales_queryset


def _xlsx_response(content_bytes, filename):
    response = HttpResponse(
        content_bytes,
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response


@login_required(login_url='login')
@manager_required
def data_exchange(request):
    return render(request, 'web/data_exchange.html')


@login_required(login_url='login')
@manager_required
def export_products(request):
    products = Product.objects.select_related('category').order_by('name')
    wb = build_products_workbook(products)
    stamp = timezone.now().strftime('%Y%m%d_%H%M')
    return _xlsx_response(workbook_to_bytes(wb), f'products_export_{stamp}.xlsx')


@login_required(login_url='login')
@manager_required
def export_products_template(request):
    wb = build_products_template_workbook()
    return _xlsx_response(workbook_to_bytes(wb), 'products_import_template.xlsx')


@login_required(login_url='login')
@manager_required
def import_products(request):
    if request.method != 'POST':
        return redirect('data_exchange')

    uploaded = request.FILES.get('file')
    if not uploaded:
        messages.error(request, 'Please choose an Excel file to upload.')
        return redirect('data_exchange')

    if not uploaded.name.lower().endswith(('.xlsx', '.xlsm')):
        messages.error(request, 'Please upload a valid .xlsx Excel file.')
        return redirect('data_exchange')

    result = import_products_from_file(uploaded)
    if result['errors']:
        for err in result['errors'][:10]:
            messages.warning(request, err)
        if len(result['errors']) > 10:
            messages.warning(request, f'...and {len(result["errors"]) - 10} more errors.')
    messages.success(
        request,
        f'Import complete: {result["created"]} created, {result["updated"]} updated.',
    )
    return redirect('inventory')


@login_required(login_url='login')
@manager_required
def export_sales(request):
    qs = get_sales_queryset(request.user).order_by('-created_at')

    date_from = request.GET.get('from')
    date_to = request.GET.get('to')
    if date_from:
        try:
            qs = qs.filter(created_at__date__gte=datetime.strptime(date_from, '%Y-%m-%d').date())
        except ValueError:
            pass
    if date_to:
        try:
            qs = qs.filter(created_at__date__lte=datetime.strptime(date_to, '%Y-%m-%d').date())
        except ValueError:
            pass

    wb = build_sales_workbook(qs)
    stamp = timezone.now().strftime('%Y%m%d_%H%M')
    return _xlsx_response(workbook_to_bytes(wb), f'sales_export_{stamp}.xlsx')


@login_required(login_url='login')
@manager_required
def export_sales_template(request):
    wb = build_sales_template_workbook()
    return _xlsx_response(workbook_to_bytes(wb), 'sales_import_template.xlsx')


@login_required(login_url='login')
@manager_required
def import_sales(request):
    if request.method != 'POST':
        return redirect('data_exchange')

    uploaded = request.FILES.get('file')
    if not uploaded:
        messages.error(request, 'Please choose an Excel file to upload.')
        return redirect('data_exchange')

    if not uploaded.name.lower().endswith(('.xlsx', '.xlsm')):
        messages.error(request, 'Please upload a valid .xlsx Excel file.')
        return redirect('data_exchange')

    result = import_sales_from_file(uploaded, default_cashier=request.user)
    if result['errors']:
        for err in result['errors'][:10]:
            messages.warning(request, err)
        if len(result['errors']) > 10:
            messages.warning(request, f'...and {len(result["errors"]) - 10} more errors.')
    if result['sales_created']:
        broadcast_dashboard_update()
    messages.success(request, f'Import complete: {result["sales_created"]} sale(s) created.')
    return redirect('sales_list')
