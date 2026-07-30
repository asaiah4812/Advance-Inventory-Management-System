from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.db.models import F

from .models import Category, Product, Sale, SaleItem
from .serializers import CategorySerializer, ProductSerializer, SaleSerializer

@api_view(['GET', 'POST'])
@permission_classes([AllowAny]) # Change to IsAuthenticated in production
def product_list(request):
    """
    List all products, or create a new product.
    """
    if request.method == 'GET':
        barcode = request.GET.get('barcode')
        if barcode:
            products = Product.objects.filter(barcode=barcode).select_related('category')
        else:
            products = Product.objects.select_related('category').all()
        serializer = ProductSerializer(products, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        serializer = ProductSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([AllowAny])
def product_detail(request, pk):
    """
    Retrieve, update or delete a product.
    """
    product = get_object_or_404(Product, pk=pk)

    if request.method == 'GET':
        serializer = ProductSerializer(product)
        return Response(serializer.data)

    elif request.method == 'PUT':
        serializer = ProductSerializer(product, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        product.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

@api_view(['GET'])
@permission_classes([AllowAny])
def category_list(request):
    """
    List all categories.
    """
    if request.method == 'GET':
        categories = Category.objects.all()
        serializer = CategorySerializer(categories, many=True)
        return Response(serializer.data)

@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def sale_list(request):
    """
    List sales (role-aware) or create a new sale.
    GET params: ?from=YYYY-MM-DD&to=YYYY-MM-DD
    Staff users (non-superuser) only see their own sales.
    """
    if request.method == 'GET':
        if request.user.is_authenticated and not request.user.is_superuser:
            # Cashier/staff: only their own sales
            sales = Sale.objects.filter(cashier=request.user).select_related('cashier').prefetch_related('items__product').order_by('-created_at')
        else:
            # Superuser/unauthenticated: all sales
            sales = Sale.objects.all().select_related('cashier').prefetch_related('items__product').order_by('-created_at')

        # Date range filters
        date_from = request.GET.get('from')
        date_to = request.GET.get('to')
        from datetime import datetime as dt
        if date_from:
            try:
                sales = sales.filter(created_at__date__gte=dt.strptime(date_from, '%Y-%m-%d').date())
            except ValueError:
                pass
        if date_to:
            try:
                sales = sales.filter(created_at__date__lte=dt.strptime(date_to, '%Y-%m-%d').date())
            except ValueError:
                pass

        serializer = SaleSerializer(sales[:500], many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        # Example Payload:
        # {
        #   "client_id": "uuid-from-client",
        #   "items": [
        #       {"product_id": 1, "quantity": 2, "unit_price": 10.50, "subtotal": 21.00}
        #   ],
        #   "total_amount": 21.00,
        #   "discount": 0.00,
        #   "grand_total": 21.00
        # }
        
        data = request.data
        items_data = data.pop('items', [])
        
        # We use a transaction so that if saving items fails, the sale isn't created
        with transaction.atomic():
            serializer = SaleSerializer(data=data)
            if serializer.is_valid():
                # Assign cashier if user is authenticated (mocked for now with AllowAny)
                cashier = request.user if request.user.is_authenticated else None
                sale = serializer.save(cashier=cashier)
                
                # Create SaleItems and deduct stock
                for item_data in items_data:
                    product = get_object_or_404(Product, pk=item_data['product_id'])
                    
                    SaleItem.objects.create(
                        sale=sale,
                        product=product,
                        quantity=item_data['quantity'],
                        unit_price=item_data['unit_price'],
                        subtotal=item_data['subtotal']
                    )
                    
                    # Deduct stock
                    product.stock_quantity -= int(item_data['quantity'])
                    product.save()
                    
                from django.core.cache import cache
                cache.clear()
                    
                result_serializer = SaleSerializer(sale)
                return Response(result_serializer.data, status=status.HTTP_201_CREATED)
            
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([AllowAny])
def offline_sync(request):
    """
    Bulk sync offline transactions to the server.
    Accepts an array of sales in the 'sales' key.
    """
    sales_data = request.data.get('sales', [])
    synced_sales = []
    errors = []

    client_ids = [s.get('client_id') for s in sales_data if s.get('client_id')]
    existing_sales = set(Sale.objects.filter(client_id__in=client_ids).values_list('client_id', flat=True))

    # Pre-fetch all products needed for the sync
    product_ids = set()
    for s in sales_data:
        for i in s.get('items', []):
            product_ids.add(i.get('product_id'))
    products_db = {p.id: p for p in Product.objects.filter(id__in=product_ids)}

    sale_items_to_create = []
    products_to_update = set()

    with transaction.atomic():
        for sale_data in sales_data:
            client_id = sale_data.get('client_id')
            if client_id in existing_sales:
                continue

            items_data = sale_data.pop('items', [])
            serializer = SaleSerializer(data=sale_data)
            
            if serializer.is_valid():
                cashier = request.user if request.user.is_authenticated else None
                sale = serializer.save(cashier=cashier)
                
                for item_data in items_data:
                    p_id = item_data['product_id']
                    if p_id in products_db:
                        product = products_db[p_id]
                        sale_items_to_create.append(
                            SaleItem(
                                sale=sale,
                                product=product,
                                quantity=item_data['quantity'],
                                unit_price=item_data['unit_price'],
                                subtotal=item_data['subtotal']
                            )
                        )
                        product.stock_quantity -= int(item_data['quantity'])
                        products_to_update.add(product)
                    else:
                        errors.append(f"Product ID {p_id} not found for sale {client_id}")
                
                synced_sales.append(SaleSerializer(sale).data)
            else:
                errors.append({"client_id": client_id, "errors": serializer.errors})
                
        if sale_items_to_create:
            SaleItem.objects.bulk_create(sale_items_to_create)
        if products_to_update:
            Product.objects.bulk_update(products_to_update, ['stock_quantity'])

    if synced_sales:
        from django.core.cache import cache
        cache.clear()
        
        from api.realtime import broadcast_dashboard_update
        broadcast_dashboard_update()

    return Response({
        "message": f"Successfully synced {len(synced_sales)} sales.",
        "synced_sales": synced_sales,
        "errors": errors
    }, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_info(request):
    return Response({
        "username": request.user.username,
        "is_staff": request.user.is_staff,
        "is_superuser": request.user.is_superuser
    })



@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_stats(request):
    from django.utils import timezone
    today = timezone.now().date()
    
    if request.user.is_superuser:
        sales = Sale.objects.filter(created_at__date=today)
    else:
        sales = Sale.objects.filter(cashier=request.user, created_at__date=today)
        
    revenue = sum([s.grand_total for s in sales])
    low_stock = Product.objects.filter(stock_quantity__lte=F('low_stock_threshold')).count()
    
    return Response({
        "today_revenue": float(revenue),
        "low_stock_count": low_stock
    })
