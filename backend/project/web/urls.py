from django.urls import path

from . import import_export_views, views

urlpatterns = [
    path('', views.landing_page, name='landing_page'),
    path('dashboard/', views.dashboard, name='dashboard'),
    path('dashboard/stats/', views.dashboard_stats, name='dashboard_stats'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('pos/', views.pos, name='pos'),
    path('sales/', views.sales_list, name='sales_list'),
    path('sales/<uuid:sale_id>/receipt/', views.sale_receipt, name='sale_receipt'),
    path('reports/', views.reports, name='reports'),
    path('low-stock/', views.low_stock, name='low_stock'),
    path('categories/', views.categories, name='categories'),
    path('categories/<int:category_id>/delete/', views.delete_category, name='delete_category'),
    path('inventory/', views.inventory, name='inventory'),
    path('inventory/add/', views.add_product, name='add_product'),
    path('inventory/edit/<int:product_id>/', views.edit_product, name='edit_product'),
    path('inventory/delete/<int:product_id>/', views.delete_product, name='delete_product'),
    path('staff/', views.staff_list, name='staff_list'),
    path('staff/toggle/<int:user_id>/', views.toggle_staff_status, name='toggle_staff'),
    path('staff/delete/<int:user_id>/', views.delete_staff, name='delete_staff'),
    path('data/', import_export_views.data_exchange, name='data_exchange'),
    path('data/products/export/', import_export_views.export_products, name='export_products'),
    path('data/products/template/', import_export_views.export_products_template, name='export_products_template'),
    path('data/products/import/', import_export_views.import_products, name='import_products'),
    path('data/sales/export/', import_export_views.export_sales, name='export_sales'),
    path('data/sales/template/', import_export_views.export_sales_template, name='export_sales_template'),
    path('data/sales/import/', import_export_views.import_sales, name='import_sales'),
]
