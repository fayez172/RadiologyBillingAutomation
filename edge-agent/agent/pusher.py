"""
pusher.py — HTTPS push with HMAC-SHA256 signing, proxy support, and retry logic.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx

from .config import AgentConfig

logger = logging.getLogger(__name__)

AGENT_VERSION = "1.0.0"


class PushError(Exception):
    """Raised when a push fails after all retries."""


class Pusher:
    def __init__(self, cfg: AgentConfig):
        self._cfg = cfg
        # In httpx 0.27+, 'proxy' is used for a single proxy string.
        # proxy_map returns {'https://': url, 'http://': url} or None
        proxy_map = cfg.network.proxy_map
        proxy = proxy_map.get("https://") if proxy_map else None
        self._client = httpx.Client(
            proxy=proxy,
            timeout=httpx.Timeout(
                connect=cfg.network.connect_timeout_seconds,
                read=cfg.network.request_timeout_seconds,
                write=cfg.network.request_timeout_seconds,
                pool=5.0,
            ),
            headers={
                "X-Agent-Version": AGENT_VERSION,
                "X-Instance-ID": cfg.instance_id,
            },
        )

    def close(self) -> None:
        self._client.close()

    def push_studies(
        self,
        studies: list[dict],
        is_backfill: bool = False,
        backfill_progress: Optional[dict] = None,
        ref_data: Optional[dict] = None,
    ) -> Optional[dict]:
        """
        Push a batch of studies to the billing API.
        Returns the parsed response body (may contain a remote command).
        """
        if not studies and not ref_data:
            return None

        payload = {
            "payload_version": "1.0",
            "instance_id": self._cfg.instance_id,
            "pushed_at": _utcnow(),
            "is_backfill": is_backfill,
            "studies": studies,
        }
        if ref_data:
            payload["ref_data"] = ref_data
        if backfill_progress:
            payload["backfill_progress"] = backfill_progress

        return self._send_with_retry(payload)

    def push_heartbeat(self) -> Optional[dict]:
        """Send a lightweight heartbeat so the billing app knows the agent is alive."""
        payload = {
            "payload_version": "1.0",
            "instance_id": self._cfg.instance_id,
            "pushed_at": _utcnow(),
            "is_heartbeat": True,
            "studies": [],
        }
        try:
            return self._send(payload)
        except Exception as exc:
            logger.warning("Heartbeat failed: %s", exc)
            return None

    def _send_with_retry(self, payload: dict, max_attempts: int = 5) -> dict:
        last_exc: Optional[Exception] = None
        for attempt in range(1, max_attempts + 1):
            try:
                return self._send(payload)
            except (httpx.TransportError, httpx.TimeoutException) as exc:
                last_exc = exc
                wait = 2 ** (attempt - 1)   # 1s, 2s, 4s, 8s, 16s
                logger.warning(
                    "Push attempt %d/%d failed (%s). Retrying in %ds.",
                    attempt, max_attempts, exc, wait,
                )
                time.sleep(wait)
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code < 500:
                    # 4xx — do not retry (bad payload / auth failure)
                    raise PushError(f"HTTP {exc.response.status_code}: {exc.response.text}") from exc
                last_exc = exc
                wait = 2 ** (attempt - 1)
                logger.warning("Server error %d. Retrying in %ds.", exc.response.status_code, wait)
                time.sleep(wait)

        raise PushError(f"Push failed after {max_attempts} attempts") from last_exc

    def _send(self, payload: dict) -> dict:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        signature = _hmac_sign(body, self._cfg.api_key)

        url = f"{self._cfg.api_endpoint}/api/ingest/{self._cfg.instance_id}"
        response = self._client.post(
            url,
            content=body,
            headers={
                "Content-Type": "application/json; charset=utf-8",
                "X-Signature": signature,
            },
        )
        response.raise_for_status()
        return response.json()

    def retry_next_retry_time(self, attempt: int) -> str:
        """ISO timestamp for when to retry a failed payload."""
        delay = timedelta(seconds=min(2 ** attempt * 30, 3600))  # max 1h
        return (datetime.now(timezone.utc) + delay).isoformat()


def _hmac_sign(body: bytes, key: str) -> str:
    return hmac.new(key.encode("utf-8"), body, hashlib.sha256).hexdigest()


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()
