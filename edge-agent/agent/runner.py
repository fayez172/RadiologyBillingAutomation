"""
runner.py — Core sync logic called by the scheduler and CLI commands.
Separated from main.py so it can be unit-tested without the scheduler.
"""

from __future__ import annotations

import logging
from typing import Optional

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


# == Backfill ==================================================================

def run_backfill(cfg: AgentConfig, state: StateDB, command_id: str | None = None) -> None:
    """Run paginated historical backfill to completion (resumable on crash)."""
    if command_id:
        # Idempotency check: check local state cache
        cached = state.get_command_status(command_id)
        if cached and cached["status"] == "COMPLETED":
            logger.info("Command %s already COMPLETED locally. Skipping.", command_id)
            return
        state.update_command(command_id, "IN_PROGRESS", progress=0)

    bf = cfg.backfill
    state.init_backfill(cfg.instance_id, bf.from_date, bf.to_date)
    row = state.get_backfill(cfg.instance_id)
    offset = row["last_offset"]

    pusher = Pusher(cfg)
    try:
        while True:
            # Check for cancellation before each batch
            if state.get_setting("cancel_requested") == "1":
                logger.warning("Backfill cancelled by remote command.")
                state.delete_setting("cancel_requested")
                if command_id:
                    state.update_command(command_id, "CANCELLED")
                break

            with cdc_reader.get_connection(cfg, cfg.mssql.reporting_db) as conn:
                batch = cdc_reader.fetch_backfill_batch(
                    conn,
                    from_date=bf.from_date,
                    to_date=bf.to_date,
                    offset=offset,
                    batch_size=bf.batch_size,
                    radiology_db=cfg.mssql.radiology_db,
                    owner_ids=cfg.owner_ids,
                )

            if not batch:
                state.complete_backfill(cfg.instance_id)
                if command_id:
                    state.update_command(command_id, "COMPLETED", progress=100)
                    # Final push to signal completion
                    pusher.push_studies([], is_backfill=True, command_id=command_id, command_status="SUCCESS")
                
                logger.info("Backfill finished. Total offset: %d", offset)
                break

            # Simplified progress calculation (if we knew total count it would be better)
            # For now, we just use the current offset as a relative progress hint
            pusher.push_studies(
                batch, 
                is_backfill=True, 
                command_id=command_id,
                command_status="IN_PROGRESS"
            )
            offset += len(batch)
            state.advance_backfill(cfg.instance_id, offset, len(batch))
            logger.info("Backfill pushed %d rows (offset=%d)", len(batch), offset)

            if command_id:
                # We don't have total rows easily, so we just increment progress based on batches
                # Dashboard will see progress moving
                state.update_command(command_id, "IN_PROGRESS", progress=min(99, offset // 100))

    except Exception as exc:
        logger.error("Backfill failed: %s", exc, exc_info=True)
        if command_id:
            state.update_command(command_id, "FAILED", error=str(exc))
            # Attempt to notify server of failure if possible
            try:
                pusher.push_studies([], is_backfill=True, command_id=command_id, command_status="FAILED", command_error=str(exc))
            except: pass
    finally:
        pusher.close()


# == CDC: FinishedReport =======================================================

def run_cdc_finished_reports(cfg: AgentConfig, state: StateDB) -> None:
    """Poll CDC for FinishedReport changes and push to billing API."""
    table = "FinishedReport"
    try:
        with cdc_reader.get_connection(cfg, cfg.mssql.reporting_db) as conn:
            current_lsn = cdc_reader.get_max_lsn(conn)
            last_lsn    = state.get_lsn(table)

            if last_lsn is None:
                # First ever CDC run — start from earliest available LSN
                from_lsn = cdc_reader.get_min_lsn(conn, FINISHED_REPORT_CAPTURE)
                logger.info("First CDC run for %s. Bootstrapping from min LSN.", table)
            else:
                from_lsn = cdc_reader.increment_lsn(conn, last_lsn)

            if current_lsn < from_lsn:
                logger.debug("No new changes in %s.", table)
                return

            changes = cdc_reader.fetch_finished_report_changes(
                conn, from_lsn, current_lsn, cfg.mssql.radiology_db, cfg.owner_ids
            )

        if not changes:
            # Still save current_lsn to advance cursor even if no rows in this range
            state.save_lsn(table, current_lsn)
            return

        logger.info("%s: %d change(s) detected.", table, len(changes))
        pusher = Pusher(cfg)
        try:
            response = pusher.push_studies(changes)
            state.save_lsn(table, current_lsn, rows_pushed=len(changes))
            _handle_remote_command(response, cfg, state)
        except PushError as exc:
            logger.error("CDC push failed for %s: %s. Enqueueing for local retry.", table, exc)
            payload = pusher.build_payload(changes)
            state.enqueue_retry(payload, error_message=str(exc))
        finally:
            pusher.close()

    except Exception as exc:
        logger.error("CDC poll failed for %s: %s", table, exc, exc_info=True)


# == CDC: Reference Tables =====================================================

def run_cdc_reference_tables(cfg: AgentConfig, state: StateDB) -> None:
    """Poll CDC for reference table changes (Radiologist, Modality, etc.)."""
    ref_data: dict = {}
    lsn_updates: dict = {}

    try:
        with cdc_reader.get_connection(cfg, cfg.mssql.radiology_db) as conn:
            current_lsn = cdc_reader.get_max_lsn(conn)

            for table, capture in REF_TABLE_CAPTURES.items():
                last_lsn = state.get_lsn(table)
                if last_lsn is None:
                    from_lsn = cdc_reader.get_min_lsn(conn, capture)
                else:
                    from_lsn = cdc_reader.increment_lsn(conn, last_lsn)

                if current_lsn < from_lsn:
                    continue

                changes = cdc_reader.fetch_reference_changes(
                    conn, table, capture, from_lsn, current_lsn, cfg.owner_ids
                )
                if changes:
                    ref_data[table.lower()] = changes
                    lsn_updates[table] = (current_lsn, len(changes))

    except Exception as exc:
        logger.error("Reference CDC poll failed: %s", exc, exc_info=True)
        return

    if not ref_data:
        return

    logger.info("Reference changes detected: %s", {k: len(v) for k, v in ref_data.items()})
    pusher = Pusher(cfg)
    try:
        pusher.push_studies([], ref_data=ref_data)
        # ONLY save LSN if push succeeded
        for table, (lsn, count) in lsn_updates.items():
            state.save_lsn(table, lsn, rows_pushed=count)
        logger.info("Reference changes pushed and LSNs advanced.")
    except PushError as exc:
        logger.error("Reference push failed: %s. Enqueueing for local retry.", exc)
        payload = pusher.build_payload([], ref_data=ref_data)
        state.enqueue_retry(payload, error_message=str(exc))
    finally:
        pusher.close()


# == Retry Queue ===============================================================

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
                state.increment_retry(item["id"], next_retry, error_message=str(exc))
                logger.warning("Retry %d failed again: %s", item["id"], exc)
    finally:
        pusher.close()


# == Command Processor =========================================================

def process_remote_commands(cfg: AgentConfig, state: StateDB) -> None:
    """Check for PENDING commands in local cache and execute them."""
    cmd = state.get_pending_command()
    if not cmd:
        return

    cmd_id = cmd["command_id"]
    cmd_type = cmd["command_type"]
    import json
    payload = json.loads(cmd["payload"]) if cmd["payload"] else {}

    if cmd_type == "backfill":
        from_date = payload.get("from_date")
        to_date = payload.get("to_date")
        
        logger.info("Executing queued backfill command [%s]: %s -> %s", cmd_id, from_date, to_date)
        
        # Override config for this run
        cfg.backfill.enabled = True
        cfg.backfill.from_date = from_date
        cfg.backfill.to_date = to_date
        
        # Reset existing backfill state for this specific instruction
        with state._conn() as conn:
            conn.execute("DELETE FROM backfill_state WHERE instance_id = ?", (cfg.instance_id,))
            
        run_backfill(cfg, state, command_id=cmd_id)
    else:
        logger.warning("Unsupported command type in queue: %s", cmd_type)
        state.update_command(cmd_id, "FAILED", error=f"Unsupported type: {cmd_type}")


# == Heartbeat =================================================================

def send_heartbeat(cfg: AgentConfig, state: StateDB) -> None:
    pusher = Pusher(cfg)
    try:
        response = pusher.push_heartbeat()
        if response:
            _handle_remote_command(response, cfg, state)
    finally:
        pusher.close()


# == Remote Command Handler ====================================================

def _handle_remote_command(response: dict | None, cfg: AgentConfig, state: StateDB | None) -> None:
    """
    The billing API can embed a command in any response.
    Queues commands for background processing.
    """
    if not response or state is None:
        return
    cmd = response.get("command")
    if not cmd:
        return

    cmd_type = cmd.get("type")
    cmd_id   = cmd.get("id")

    if cmd_type == "cancel":
        # Check if this command ID matches what we are currently running
        with state._conn() as conn:
            active = conn.execute("SELECT command_id FROM command_cache WHERE status = 'IN_PROGRESS'").fetchone()
            if active and active["command_id"] == cmd_id:
                logger.info("Received cancellation for command: %s", cmd_id)
                state.set_setting("cancel_requested", "1")
        return

    if cmd_type == "backfill":
        # Idempotency: Check if we already handled this command
        cached = state.get_command_status(cmd_id)
        if cached and cached["status"] in ("PENDING", "IN_PROGRESS", "COMPLETED"):
            logger.debug("Remote backfill command %s already %s. Skipping queue.", cmd_id, cached["status"])
            return

        logger.info("Queuing remote backfill command: %s (%s -> %s)", cmd_id, cmd.get("from_date"), cmd.get("to_date"))
        state.update_command(cmd_id, "PENDING", command_type="backfill", payload=cmd)
    else:
        logger.warning("Unknown remote command type from API: %s", cmd_type)
