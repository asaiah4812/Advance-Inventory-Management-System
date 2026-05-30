"""
ASGI config — HTTP via Django, WebSockets via Channels when installed.
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'project.settings')

django_asgi_app = get_asgi_application()

try:
    from channels.auth import AuthMiddlewareStack
    from channels.routing import ProtocolTypeRouter, URLRouter
    from django.conf import settings
    import web.routing  # noqa: E402

    websocket_stack = AuthMiddlewareStack(
        URLRouter(web.routing.websocket_urlpatterns)
    )

    if not settings.DEBUG:
        from channels.security.websocket import AllowedHostsOriginValidator
        websocket_stack = AllowedHostsOriginValidator(websocket_stack)

    application = ProtocolTypeRouter({
        'http': django_asgi_app,
        'websocket': websocket_stack,
    })
except ImportError:
    application = django_asgi_app
