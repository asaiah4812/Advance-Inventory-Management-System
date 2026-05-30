from functools import wraps

from django.contrib import messages
from django.shortcuts import redirect


def manager_required(view_func):
    """Only superusers (store managers/admins) may access import/export."""

    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect('login')
        if not request.user.is_superuser:
            messages.error(request, 'Only administrators can import or export data.')
            return redirect('dashboard')
        return view_func(request, *args, **kwargs)

    return wrapper
