from django.urls import path
from . import views

urlpatterns = [
    path('products/', views.product_list, name='product-list'),
    path('products/<int:pk>/', views.product_detail, name='product-detail'),
    path('categories/', views.category_list, name='category-list'),
    path('sales/', views.sale_list, name='sale-list'),
    path('sync/', views.offline_sync, name='offline-sync'),
    path('me/', views.get_user_info, name='user-info'),
    path('stats/', views.get_stats, name='api-stats'),
]
