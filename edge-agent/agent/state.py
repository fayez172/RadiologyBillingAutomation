"""
state.py — SQLite-backed state management.
Stores CDC LSN cursors, backfill progress, and retry queue.
"""

from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Generator, Optional


class StateDB:
    """Thread-safe SQLite state store for the edge agent."""

    def __init__(self, db_path: Path):
        self._path = db_path
        self._init_schema()

    @contextmanager
    def _conn(self) -> Generator[sqlite3.Connection, None, None]:
        conn = sqlite3.connect(self._path, timeout=10, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _init_schema(self) -> None:
        with self._conn() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS cdc_cursors (
                    table_name        TEXT PRIMARY KEY,
                    last_lsn          BLOB,
                    last_pushed_at    TEXT,
                    rows_pushed_total INTEGER DEFAULT 0
                );

                CREATE TABLE IF NOT EXISTS backfill_state (
                    instance_id    TEXT PRIMARY KEY,
                    from_date      TEXT,
                    to_date        TEXT,
                    last_offset    INTEGER DEFAULT 0,
                    total_pushed   INTEGER DEFAULT 0,
                    completed      INTEGER DEFAULT 0,
                    started_at     TEXT,
                    completed_at   TEXT
                );

                CREATE TABLE IF NOT EXISTS retry_queue (
                    id         INTEGER PRIMARY KEY AUTOINCREMENT,
                    payload    TEXT NOT NULL,
                    attempts   INTEGER DEFAULT 0,
                    created_at TEXT,
                    next_retry TEXT,
                    error_message TEXT
                );

                CREATE TABLE IF NOT EXISTS command_cache (
                    command_id    TEXT PRIMARY KEY,
                    command_type  TEXT,
                    payload       TEXT, -- JSON string
                    status        TEXT, -- PENDING, IN_PROGRESS, COMPLETED, FAILED, CANCELLED
                    progress      INTEGER DEFAULT 0,
                    error_message TEXT,
                    updated_at    TEXT
                );

                CREATE TABLE IF NOT EXISTS settings (
                    key   TEXT PRIMARY KEY,
                    value TEXT
                );
            """)
            # Migration: Ensure new columns exist
            try:
                conn.execute("ALTER TABLE command_cache ADD COLUMN command_type TEXT")
            except: pass
            try:
                conn.execute("ALTER TABLE command_cache ADD COLUMN payload TEXT")
            except: pass

    # ── CDC Cursor ─────────────────────────────────────────────────────────────

    def get_lsn(self, table_name: str) -> Optional[bytes]:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT last_lsn FROM cdc_cursors WHERE table_name = ?",
                (table_name,),
            ).fetchone()
            return bytes(row["last_lsn"]) if row and row["last_lsn"] else None

    def save_lsn(self, table_name: str, lsn: bytes, rows_pushed: int = 0) -> None:
        now = _utcnow()
        with self._conn() as conn:
            conn.execute("""
                INSERT INTO cdc_cursors (table_name, last_lsn, last_pushed_at, rows_pushed_total)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(table_name) DO UPDATE SET
                    last_lsn          = excluded.last_lsn,
                    last_pushed_at    = excluded.last_pushed_at,
                    rows_pushed_total = rows_pushed_total + excluded.rows_pushed_total
            """, (table_name, lsn, now, rows_pushed))

    # ── Backfill State ─────────────────────────────────────────────────────────

    def get_backfill(self, instance_id: str) -> Optional[sqlite3.Row]:
        with self._conn() as conn:
            return conn.execute(
                "SELECT * FROM backfill_state WHERE instance_id = ?",
                (instance_id,),
            ).fetchone()

    def init_backfill(self, instance_id: str, from_date: str, to_date: str) -> None:
        with self._conn() as conn:
            conn.execute("""
                INSERT OR IGNORE INTO backfill_state
                    (instance_id, from_date, to_date, started_at)
                VALUES (?, ?, ?, ?)
            """, (instance_id, from_date, to_date, _utcnow()))

    def advance_backfill(self, instance_id: str, offset: int, pushed: int) -> None:
        with self._conn() as conn:
            conn.execute("""
                UPDATE backfill_state
                SET last_offset  = ?,
                    total_pushed = total_pushed + ?
                WHERE instance_id = ?
            """, (offset, pushed, instance_id))

    def complete_backfill(self, instance_id: str) -> None:
        with self._conn() as conn:
            conn.execute("""
                UPDATE backfill_state
                SET completed    = 1,
                    completed_at = ?
                WHERE instance_id = ?
            """, (_utcnow(), instance_id))

    def is_backfill_complete(self, instance_id: str) -> bool:
        row = self.get_backfill(instance_id)
        return bool(row and row["completed"])

    # ── Command Cache ──────────────────────────────────────────────────────────

    def get_command_status(self, command_id: str) -> Optional[sqlite3.Row]:
        with self._conn() as conn:
            return conn.execute(
                "SELECT * FROM command_cache WHERE command_id = ?",
                (command_id,),
            ).fetchone()

    def get_pending_command(self) -> Optional[sqlite3.Row]:
        with self._conn() as conn:
            return conn.execute(
                "SELECT * FROM command_cache WHERE status = 'PENDING' LIMIT 1"
            ).fetchone()

    def update_command(
        self, 
        command_id: str, 
        status: str, 
        progress: int = 0, 
        error: str = None,
        command_type: str = None,
        payload: dict = None
    ) -> None:
        now = _utcnow()
        payload_str = json.dumps(payload) if payload else None
        with self._conn() as conn:
            conn.execute("""
                INSERT INTO command_cache (command_id, status, progress, error_message, updated_at, command_type, payload)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(command_id) DO UPDATE SET
                    status        = excluded.status,
                    progress      = excluded.progress,
                    error_message = excluded.error_message,
                    updated_at    = excluded.updated_at,
                    command_type  = COALESCE(excluded.command_type, command_cache.command_type),
                    payload       = COALESCE(excluded.payload, command_cache.payload)
            """, (command_id, status, progress, error, now, command_type, payload_str))

    # ── Retry Queue ────────────────────────────────────────────────────────────

    def enqueue_retry(self, payload: dict, error_message: str = None) -> None:
        with self._conn() as conn:
            conn.execute("""
                INSERT INTO retry_queue (payload, created_at, next_retry, error_message)
                VALUES (?, ?, ?, ?)
            """, (json.dumps(payload), _utcnow(), _utcnow(), error_message))

    def get_due_retries(self, limit: int = 10) -> list[sqlite3.Row]:
        with self._conn() as conn:
            return conn.execute("""
                SELECT * FROM retry_queue
                WHERE next_retry <= ?
                  AND attempts < 10
                ORDER BY id
                LIMIT ?
            """, (_utcnow(), limit)).fetchall()

    def mark_retry_success(self, retry_id: int) -> None:
        with self._conn() as conn:
            conn.execute("DELETE FROM retry_queue WHERE id = ?", (retry_id,))

    def increment_retry(self, retry_id: int, next_retry_iso: str, error_message: str = None) -> None:
        with self._conn() as conn:
            conn.execute("""
                UPDATE retry_queue
                SET attempts   = attempts + 1,
                    next_retry = ?,
                    error_message = COALESCE(?, error_message)
                WHERE id = ?
            """, (next_retry_iso, error_message, retry_id))


    # ── Settings ───────────────────────────────────────────────────────────────

    def get_setting(self, key: str) -> Optional[str]:
        with self._conn() as conn:
            row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
            return row["value"] if row else None

    def set_setting(self, key: str, value: str) -> None:
        with self._conn() as conn:
            conn.execute("""
                INSERT INTO settings (key, value) VALUES (?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value
            """, (key, value))

    def delete_setting(self, key: str) -> None:
        with self._conn() as conn:
            conn.execute("DELETE FROM settings WHERE key = ?", (key,))


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()
