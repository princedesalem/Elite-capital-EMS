"""
Web Push helper utilities.

Uses pywebpush when configured with VAPID keys.
"""
from __future__ import annotations

import json
import os
from typing import Any, Dict, Optional, Tuple


WEBPUSH_PUBLIC_KEY = os.getenv('WEBPUSH_PUBLIC_KEY', '').strip()
WEBPUSH_PRIVATE_KEY = os.getenv('WEBPUSH_PRIVATE_KEY', '').strip()
WEBPUSH_SUBJECT = os.getenv('WEBPUSH_SUBJECT', 'mailto:admin@example.com').strip()


def is_webpush_configured() -> bool:
    return bool(WEBPUSH_PUBLIC_KEY and WEBPUSH_PRIVATE_KEY)


def vapid_public_key() -> str:
    return WEBPUSH_PUBLIC_KEY


def send_webpush(
    subscription_info: Dict[str, Any],
    title: str,
    body: str,
    data: Optional[Dict[str, Any]] = None,
) -> Tuple[bool, Optional[str]]:
    """
    Send a push payload to a browser subscription.

    Returns:
        (True, None) if sent
        (False, reason) if failed, where reason can be 'not-configured',
        'missing-lib', 'gone', or 'error'.
    """
    if not is_webpush_configured():
        return False, 'not-configured'

    try:
        from pywebpush import webpush, WebPushException  # type: ignore
    except Exception:
        return False, 'missing-lib'

    payload = json.dumps({
        'title': title or 'Nouvelle notification EMS',
        'body': body or '',
        'data': data or {},
    })

    try:
        webpush(
            subscription_info=subscription_info,
            data=payload,
            vapid_private_key=WEBPUSH_PRIVATE_KEY,
            vapid_claims={'sub': WEBPUSH_SUBJECT},
        )
        return True, None
    except WebPushException as exc:  # pragma: no cover - depends on remote push service
        message = str(exc)
        status_code = getattr(getattr(exc, 'response', None), 'status_code', None)
        if status_code in (404, 410):
            return False, 'gone'
        if '404' in message or '410' in message:
            return False, 'gone'
        return False, 'error'
    except Exception:
        return False, 'error'
