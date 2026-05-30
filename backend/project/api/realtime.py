"""Push dashboard updates to all connected WebSocket clients."""
from asgiref.sync import async_to_sync


def broadcast_dashboard_update():
    from django.conf import settings

    if not getattr(settings, 'CHANNELS_ENABLED', False):
        return

    try:
        from channels.layers import get_channel_layer
    except ImportError:
        return

    channel_layer = get_channel_layer()
    if channel_layer is None:
        return

    async_to_sync(channel_layer.group_send)(
        'dashboard',
        {'type': 'dashboard.refresh'},
    )
