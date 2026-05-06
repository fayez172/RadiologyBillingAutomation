"""
pusher.py — HTTPS push with HMAC-SHA256 signing, proxy support, and retry logic.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx

from .config import AgentConfig

logger = logging.getLogger(__name__)

AGENT_VERSION = "1.1.0"


class PushError(Exception):
    """Raised when a push fails after all retries."""


class Pusher:
    def __init__(self, cfg: AgentConfig):
        self._cfg = cfg
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

    def build_payload(
        self,
        studies: list[dict],
        is_backfill: bool = False,
        backfill_progress: Optional[dict] = None,
        ref_data: Optional[dict] = None,
        command_id: Optional[str] = None,
        command_status: Optional[str] = None,
        command_error: Optional[str] = None,
        message_id: Optional[str] = None,
    ) -> dict:
        """Construct the standard ingest payload."""
        payload = {
            "payload_version": "1.2",
            "instance_id": self._cfg.instance_id,
            "message_id": message_id or str(uuid.uuid4()),
            "pushed_at": _utcnow(),
            "is_backfill": is_backfill,
            "studies": studies,
        }
        if ref_data:
            payload["ref_data"] = ref_data
        if backfill_progress:
            payload["backfill_progress"] = backfill_progress
        if command_id:
            payload["command_id"] = command_id
        if command_status:
            payload["command_status"] = command_status
        if command_error:
            payload["command_error"] = command_error
            
        return payload

    def push_studies(
        self,
        studies: list[dict],
        is_backfill: bool = False,
        backfill_progress: Optional[dict] = None,
        ref_data: Optional[dict] = None,
        command_id: Optional[str] = None,
        command_status: Optional[str] = None,
        command_error: Optional[str] = None,
    ) -> Optional[dict]:
        """
        Push a batch of studies to the billing API.
        Returns the parsed response body (may contain a remote command).
        """
        if not studies and not ref_data and not command_id:
            return None

        payload = self.build_payload(
            studies=studies,
            is_backfill=is_backfill,
            backfill_progress=backfill_progress,
            ref_data=ref_data,
            command_id=command_id,
            command_status=command_status,
            command_error=command_error
        )

        return self._send_with_retry(payload)

    def push_heartbeat(self) -> Optional[dict]:
        """Send a lightweight heartbeat so the billing app knows the agent is alive."""
        payload = self.build_payload(studies=[], is_heartbeat=True)
        payload["is_heartbeat"] = True # Explicitly add since build_payload doesn't have it as arg
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
                wait = 2 ** (attempt - 1)
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
        
        timestamp = str(int(time.time()))
        nonce = uuid.uuid4().hex
        
        signature = _hmac_sign(self._cfg.api_key, timestamp, nonce, body)

        url = f"{self._cfg.api_endpoint}/api/ingest/{self._cfg.instance_id}"
        response = self._client.post(
            url,
            content=body,
            headers={
                "Content-Type": "application/json; charset=utf-8",
                "X-Signature": signature,
                "X-Timestamp": timestamp,
                "X-Nonce": nonce,
            },
        )
        response.raise_for_status()
        return response.json()

    def retry_next_retry_time(self, attempt: int) -> str:
        """ISO timestamp for when to retry a failed payload."""
        delay = timedelta(seconds=min(2 ** attempt * 30, 3600))  # max 1h
        return (datetime.now(timezone.utc) + delay).isoformat()


def _hmac_sign(key: str, timestamp: str, nonce: str, body: bytes) -> str:
    """
    Signs the request using HMAC-SHA256.
    Base string = timestamp + nonce + body
    """
    base = timestamp.encode("utf-8") + nonce.encode("utf-8") + body
    return hmac.new(key.encode("utf-8"), base, hashlib.sha256).hexdigest()


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()
