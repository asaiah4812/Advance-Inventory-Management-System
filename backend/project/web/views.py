from datetime import datetime, timedelta

from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.contrib.auth import authenticate, login as auth_login, logout as auth_logout
from django.contrib import messages
from django.contrib.auth.models import User
from django.db.models import F, Sum, Count
from django.http import JsonResponse
from django.utils import timezone
from api.models import Product, Sale, SaleItem, Category
from django.shortcuts import get_object_or_404
import json
from django.core.serializers.json import DjangoJSONEncoder

from .analytics import get_dashboard_payload, get_reports_context, get_sales_queryset as analytics_sales_qs
from .helpers import get_sales_queryset, get_sale_for_user, build_receipt_context

def login_view(request):
    if request.user.is_authenticated:
        return redirect('dashboard')
        
    if request.method == 'POST':
        u = request.POST.get('username')
        p = request.POST.get('password')
        user = authenticate(request, username=u, password=p)
        if user is not None:
            auth_login(request, user)
            return redirect('dashboard')
        else:
            messages.error(request, 'Invalid credentials')
            
    return render(request, 'web/login.html')

def logout_view(request):
    auth_logout(request)
    return redirect('login')

@login_required(login_url='login')
def dashboard(request):
    payload = get_dashboard_payload(request.user)
    from django.conf import settings

    context = {
        'is_manager': request.user.is_superuser,
        'dashboard_data': payload,
        'channels_enabled': getattr(settings, 'CHANNELS_ENABLED', False),
        'debug': settings.DEBUG,
    }
    return render(request, 'web/dashboard.html', context)


@login_required(login_url='login')
def dashboard_stats(request):
    """JSON endpoint for dashboard data (polling / initial load)."""
    response = JsonResponse(get_dashboard_payload(request.user))
    response['Cache-Control'] = 'no-store, no-cache, must-revalidate'
    return response

@login_required(login_url='login')
def sales_list(request):
    qs = get_sales_queryset(request.user).order_by('-created_at')

    date_from = request.GET.get('from')
    date_to = request.GET.get('to')
    cashier_id = request.GET.get('cashier')

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
    if request.user.is_superuser and cashier_id:
        qs = qs.filter(cashier_id=cashier_id)

    sales = qs[:200]
    cashiers = User.objects.filter(is_staff=True).order_by('username') if request.user.is_superuser else []

    return render(request, 'web/sales.html', {
        'sales': sales,
        'cashiers': cashiers,
        'is_manager': request.user.is_superuser,
        'filters': {
            'from': date_from or '',
            'to': date_to or '',
            'cashier': cashier_id or '',
        },
    })


@login_required(login_url='login')
def sale_receipt(request, sale_id):
    sale = get_sale_for_user(request.user, sale_id)
    context = build_receipt_context(sale)
    context['print_mode'] = request.GET.get('print') == '1'
    return render(request, 'web/receipt.html', context)


@login_required(login_url='login')
def low_stock(request):
    products = Product.objects.filter(
        stock_quantity__lte=F('low_stock_threshold')
    ).select_related('category').order_by('stock_quantity', 'name')
    return render(request, 'web/low_stock.html', {'products': products})


@login_required(login_url='login')
def categories(request):
    if request.method == 'POST':
        name = request.POST.get('name', '').strip()
        description = request.POST.get('description', '').strip()
        if name:
            Category.objects.create(name=name, description=description or None)
            messages.success(request, f'Category "{name}" created.')
        else:
            messages.error(request, 'Category name is required.')
        return redirect('categories')

    cats = Category.objects.annotate(
        product_count=Count('products')
    ).order_by('name')
    return render(request, 'web/categories.html', {'categories': cats})


@login_required(login_url='login')
def delete_category(request, category_id):
    category = get_object_or_404(Category, id=category_id)
    name = category.name
    category.delete()
    messages.success(request, f'Category "{name}" deleted.')
    return redirect('categories')


@login_required(login_url='login')
def reports(request):
    if not request.user.is_superuser:
        messages.error(request, 'Only managers can view reports.')
        return redirect('dashboard')

    from django.conf import settings
    ctx = get_reports_context(request.user)

    return render(request, 'web/reports.html', {
        'summary': ctx['summary'],
        'top_products': ctx['top_products'],
        'workers': ctx['workers'],
        'inventory': ctx['inventory'],
        'low_stock_products': ctx['low_stock_products'],
        'daily_breakdown': ctx['daily_breakdown'],
        'weekly_breakdown': ctx['weekly_breakdown'],
        'monthly_breakdown': ctx['monthly_breakdown'],
        'generated_at': ctx['generated_at'],
        'earnings_daily_json': json.dumps(ctx['earnings']['daily'], cls=DjangoJSONEncoder),
        'earnings_weekly_json': json.dumps(ctx['earnings']['weekly'], cls=DjangoJSONEncoder),
        'earnings_monthly_json': json.dumps(ctx['earnings']['monthly'], cls=DjangoJSONEncoder),
        'inventory_json': json.dumps(ctx['inventory'], cls=DjangoJSONEncoder),
        'debug': settings.DEBUG,
    })


@login_required(login_url='login')
def pos(request):
    # Pass all products to frontend so they can be searched quickly via Alpine.js
    products_list = list(Product.objects.values('id', 'name', 'barcode', 'price', 'stock_quantity'))
    # Serialize to JSON to handle decimals and nulls correctly for JS
    products_json = json.dumps(products_list, cls=DjangoJSONEncoder)
    return render(request, 'web/pos.html', {'products': products_json})

@login_required(login_url='login')
def inventory(request):
    products = Product.objects.all().order_by('name')
    return render(request, 'web/products.html', {'products': products})

@login_required(login_url='login')
def add_product(request):
    categories = Category.objects.all()
    
    if request.method == 'POST':
        name = request.POST.get('name')
        barcode = request.POST.get('barcode')
        price = request.POST.get('price')
        stock_quantity = request.POST.get('stock_quantity')
        category_id = request.POST.get('category')
        image = request.FILES.get('image')
        
        if name and barcode and price:
            category = Category.objects.filter(id=category_id).first() if category_id else None
            
            Product.objects.create(
                name=name,
                barcode=barcode,
                price=price,
                stock_quantity=stock_quantity or 0,
                category=category,
                image=image
            )
            messages.success(request, 'Product added successfully!')
            return redirect('inventory')
        else:
            messages.error(request, 'Please fill in all required fields.')
            
    return render(request, 'web/add_product.html', {'categories': categories})

@login_required(login_url='login')
def staff_list(request):
    if not request.user.is_superuser:
        messages.error(request, 'Only managers can access staff management.')
        return redirect('dashboard')
        
    from django.contrib.auth.models import User
    
    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')
        email = request.POST.get('email')
        
        if username and password:
            if User.objects.filter(username=username).exists():
                messages.error(request, 'Username already exists.')
            else:
                user = User.objects.create_user(username=username, password=password, email=email)
                user.is_staff = True  # All created through here are staff
                user.save()
                messages.success(request, f'Staff {username} created successfully!')
        else:
            messages.error(request, 'Username and Password are required.')
            
    staff_members = User.objects.filter(is_staff=True).exclude(is_superuser=True).order_by('-date_joined')
    return render(request, 'web/staff.html', {'staff_members': staff_members})

@login_required(login_url='login')
def toggle_staff_status(request, user_id):
    if not request.user.is_superuser:
        return redirect('dashboard')
        
    from django.contrib.auth.models import User
    user = get_object_or_404(User, id=user_id)
    user.is_active = not user.is_active
    user.save()
    status = "enabled" if user.is_active else "disabled"
    messages.success(request, f'Account for {user.username} has been {status}.')
    return redirect('staff_list')

@login_required(login_url='login')
def delete_staff(request, user_id):
    if not request.user.is_superuser:
        return redirect('dashboard')
        
    from django.contrib.auth.models import User
    user = get_object_or_404(User, id=user_id)
    username = user.username
    user.delete()
    messages.success(request, f'Staff member {username} deleted successfully.')
    return redirect('staff_list')

@login_required(login_url='login')
def edit_product(request, product_id):
    product = get_object_or_404(Product, id=product_id)
    categories = Category.objects.all()
    
    if request.method == 'POST':
        name = request.POST.get('name')
        barcode = request.POST.get('barcode')
        price = request.POST.get('price')
        stock_quantity = request.POST.get('stock_quantity')
        category_id = request.POST.get('category')
        image = request.FILES.get('image')
        
        if name and barcode and price:
            category = Category.objects.filter(id=category_id).first() if category_id else None
            
            product.name = name
            product.barcode = barcode
            product.price = price
            product.stock_quantity = stock_quantity or 0
            product.category = category
            if image:
                product.image = image
            product.save()
            
            messages.success(request, 'Product updated successfully!')
            return redirect('inventory')
        else:
            messages.error(request, 'Please fill in all required fields.')
            
    return render(request, 'web/edit_product.html', {'product': product, 'categories': categories})

@login_required(login_url='login')
def delete_product(request, product_id):
    product = get_object_or_404(Product, id=product_id)
    name = product.name
    product.delete()
    messages.success(request, f'Product "{name}" deleted successfully.')
    return redirect('inventory')

import socket
import json
import qrcode
from io import BytesIO
from django.http import HttpResponse

@login_required(login_url='login')
def connection_qr(request):
    """
    Generate a QR code containing the local network IP of the server.
    """
    port = request.META.get('SERVER_PORT', '8000')
    try:
        # Get local IP
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
    except Exception:
        local_ip = "127.0.0.1"

    backend_url = f"http://{local_ip}:{port}"
    data = json.dumps({"app": "mydream_inventory", "url": backend_url})
    
    img = qrcode.make(data)
    buf = BytesIO()
    img.save(buf, format='PNG')
    return HttpResponse(buf.getvalue(), content_type="image/png")
