import json
import logging

from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

from .analytics import get_dashboard_payload

logger = logging.getLogger(__name__)


class DashboardConsumer(AsyncWebsocketConsumer):
    group_name = 'dashboard'

    async def connect(self):
        user = self.scope['user']
        if not user.is_authenticated:
            logger.warning('Dashboard WS rejected: anonymous user')
            await self.close(code=4401)
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        logger.info('Dashboard WS connected: %s', user.username)
        await self.send_dashboard_data()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)
        logger.info('Dashboard WS disconnected (code=%s)', close_code)

    async def receive(self, text_data=None, bytes_data=None):
        if text_data:
            try:
                message = json.loads(text_data)
            except json.JSONDecodeError:
                return
            if message.get('action') == 'refresh':
                await self.send_dashboard_data()

    async def dashboard_refresh(self, event):
        await self.send_dashboard_data()

    async def send_dashboard_data(self):
        user = self.scope['user']
        payload = await database_sync_to_async(get_dashboard_payload)(user)
        await self.send(text_data=json.dumps({
            'type': 'dashboard_update',
            'data': payload,
        }))
