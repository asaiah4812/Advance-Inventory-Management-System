from django.db import transaction
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .models import Sale
from .realtime import broadcast_dashboard_update


def schedule_dashboard_refresh():
    """Broadcast after the DB transaction commits (includes all sale line items)."""
    transaction.on_commit(broadcast_dashboard_update)


@receiver(post_save, sender=Sale)
def sale_saved(sender, instance, created, **kwargs):
    schedule_dashboard_refresh()


@receiver(post_delete, sender=Sale)
def sale_deleted(sender, instance, **kwargs):
    schedule_dashboard_refresh()
