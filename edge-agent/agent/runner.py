"""
runner.py — Core sync logic called by the scheduler and CLI commands.
Separated from main.py so it can be unit-tested without the scheduler.
"""

from __future__ import annotations

import logging

from .config import AgentConfig
from .state import StateDB
from .pusher import Pusher, PushError
from . import cdc_reader

logger = logging.getLogger(__name__)

# Capture instance names used by CDC functions (derived from table names)
FINISHED_REPORT_CAPTURE = "dbo_FinishedReport"
REF_TABLE_CAPTURES = {
    "Radiologist": "dbo_Radiologist",
    "Modality":    "dbo_Modality",
    "StudySource": "dbo_StudySource",
    "Procedure":   "dbo_Procedure",
}


# ── Backfill ──────────────────────────────────────────────────────────────────

def run_backfill(cfg: AgentConfig, state: StateDB) -> None:
    """Run paginated historical backfill to completion (resumable on crash)."""
    bf = cfg.backfill
    state.init_backfill(cfg.instance_id, bf.from_date, bf.to_date)
    row = state.get_backfill(cfg.instance_id)
    offset = row["last_offset"]

    pusher = Pusher(cfg)
    try:
        while True:
            with cdc_reader.get_connection(cfg, cfg.mssql.reporting_db) as conn:
                batch = cdc_reader.fetch_backfill_batch(
                    conn,
                    from_date=bf.from_date,
                    to_date=bf.to_date,
                    offset=offset,
                    batch_size=bf.batch_size,
                    radiology_db=cfg.mssql.radiology_db,
                )

            if not batch:
                state.complete_backfill(cfg.instance_id)
                logger.info("Backfill finished. Total offset: %d", offset)
                break

            progress = {
                "total_pushed": offset + len(batch),
                "batch_offset": offset,
                "is_complete": False,
            }
            pusher.push_studies(batch, is_backfill=True, backfill_progress=progress)
            offset += len(batch)
            state.advance_backfill(cfg.instance_id, offset, len(batch))
            logger.info("Backfill pushed %d rows (offset=%d)", len(batch), offset)
    except PushError as exc:
        logger.error("Backfill push failed: %s — will resume on next run.", exc)
    finally:
        pusher.close()


# ── CDC: FinishedReport ───────────────────────────────────────────────────────

def run_cdc_finished_reports(cfg: AgentConfig, state: StateDB) -> None:
    """Poll CDC for FinishedReport changes and push to billing API."""
    table = "FinishedReport"
    try:
        with cdc_reader.get_connection(cfg, cfg.mssql.reporting_db) as conn:
            current_lsn = cdc_reader.get_max_lsn(conn)
            last_lsn    = state.get_lsn(table)

            if last_lsn is None:
                # First ever CDC run — start from earliest available LSN
                last_lsn = cdc_reader.get_min_lsn(conn, FINISHED_REPORT_CAPTURE)
                logger.info("First CDC run for %s. Bootstrapping from min LSN.", table)

            if current_lsn <= last_lsn:
                logger.debug("No new changes in %s.", table)
                return

            changes = cdc_reader.fetch_finished_report_changes(
                conn, last_lsn, current_lsn, cfg.mssql.radiology_db
            )

        if not changes:
            state.save_lsn(table, current_lsn)
            return

        logger.info("%s: %d change(s) detected.", table, len(changes))
        pusher = Pusher(cfg)
        try:
            response = pusher.push_studies(changes)
            state.save_lsn(table, current_lsn, rows_pushed=len(changes))
            _handle_remote_command(response, cfg, state)
        finally:
            pusher.close()

    except Exception as exc:
        logger.error("CDC poll failed for %s: %s", table, exc, exc_info=True)


# ── CDC: Reference Tables ─────────────────────────────────────────────────────

def run_cdc_reference_tables(cfg: AgentConfig, state: StateDB) -> None:
    """Poll CDC for reference table changes (Radiologist, Modality, etc.)."""
    ref_data: dict = {}

    try:
        with cdc_reader.get_connection(cfg, cfg.mssql.radiology_db) as conn:
            current_lsn = cdc_reader.get_max_lsn(conn)

            for table, capture in REF_TABLE_CAPTURES.items():
                last_lsn = state.get_lsn(table)
                if last_lsn is None:
                    last_lsn = cdc_reader.get_min_lsn(conn, capture)

                if current_lsn <= last_lsn:
                    continue

                changes = cdc_reader.fetch_reference_changes(
                    conn, table, capture, last_lsn, current_lsn
                )
                if changes:
                    ref_data[table.lower()] = changes
                    state.save_lsn(table, current_lsn, rows_pushed=len(changes))

    except Exception as exc:
        logger.error("Reference CDC poll failed: %s", exc, exc_info=True)
        return

    if not ref_data:
        return

    logger.info("Reference changes: %s", {k: len(v) for k, v in ref_data.items()})
    pusher = Pusher(cfg)
    try:
        pusher.push_studies([], ref_data=ref_data)
    except PushError as exc:
        logger.error("Reference push failed: %s", exc)
    finally:
        pusher.close()


# ── Retry Queue ───────────────────────────────────────────────────────────────

def flush_retry_queue(cfg: AgentConfig, state: StateDB) -> None:
    """Attempt to push any previously failed payloads."""
    due = state.get_due_retries()
    if not due:
        return

    pusher = Pusher(cfg)
    try:
        for item in due:
            import json
            payload = json.loads(item["payload"])
            try:
                pusher._send(payload)
                state.mark_retry_success(item["id"])
                logger.info("Retry %d succeeded.", item["id"])
            except Exception as exc:
                next_retry = pusher.retry_next_retry_time(item["attempts"])
                state.increment_retry(item["id"], next_retry)
                logger.warning("Retry %d failed again: %s", item["id"], exc)
    finally:
        pusher.close()


# ── Heartbeat ─────────────────────────────────────────────────────────────────

def send_heartbeat(cfg: AgentConfig) -> None:
    pusher = Pusher(cfg)
    try:
        response = pusher.push_heartbeat()
        if response:
            _handle_remote_command(response, cfg, None)
    finally:
        pusher.close()


# ── Remote Command Handler ────────────────────────────────────────────────────

def _handle_remote_command(response: dict | None, cfg: AgentConfig, state: StateDB | None) -> None:
    """
    The billing API can embed a command in any response.
    Currently supported: 'backfill' with from_date/to_date.
    """
    if not response:
        return
    cmd = response.get("command")
    if not cmd:
        return

    cmd_type = cmd.get("type")
    if cmd_type == "backfill" and state is not None:
        from_date = cmd.get("from_date")
        to_date   = cmd.get("to_date")
        logger.info(
            "Remote backfill command received: %s → %s", from_date, to_date
        )
        cfg.backfill.enabled   = True
        cfg.backfill.from_date = from_date
        cfg.backfill.to_date   = to_date
        # Reset existing backfill state to start fresh
        with state._conn() as conn:
            conn.execute(
                "DELETE FROM backfill_state WHERE instance_id = ?",
                (cfg.instance_id,),
            )
        run_backfill(cfg, state)
    else:
        logger.warning("Unknown remote command type: %s", cmd_type)
