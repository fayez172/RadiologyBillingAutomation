"""
main.py — Agent entry point and scheduler.

Modes:
  run          (default) Start the agent: backfill if needed, then live CDC.
  backfill     Manual re-sync for a custom date range.
  setup-cdc    Run the one-time CDC enablement SQL on the target SQL Server.
  status       Print current state from state.db.
"""

from __future__ import annotations

import logging
import logging.handlers
import sys
from pathlib import Path

import click
from apscheduler.schedulers.blocking import BlockingScheduler

from .config import AgentConfig, load_config
from .state import StateDB
from . import cdc_reader, runner

# ── Logging Setup ─────────────────────────────────────────────────────────────

def setup_logging(cfg: AgentConfig, log_dir: Path) -> None:
    log_dir.mkdir(parents=True, exist_ok=True)
    log_file = log_dir / "agent.log"

    fmt = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    file_handler = logging.handlers.RotatingFileHandler(
        log_file,
        maxBytes=cfg.logging.max_file_size_mb * 1_048_576,
        backupCount=cfg.logging.backup_count,
        encoding="utf-8",
    )
    file_handler.setFormatter(fmt)

    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(fmt)

    logging.basicConfig(
        level=getattr(logging, cfg.logging.level.upper(), logging.INFO),
        handlers=[file_handler, stream_handler],
    )


# ── CLI ───────────────────────────────────────────────────────────────────────

def _resolve_paths(ctx_obj: dict) -> tuple[AgentConfig, StateDB, Path]:
    base = ctx_obj["base_dir"]
    cfg  = load_config(base / "config.yaml")
    state = StateDB(base / "state.db")
    return cfg, state, base


@click.group(invoke_without_command=True)
@click.option(
    "--dir", "base_dir",
    default=r"C:\Program Files\TeleRadBillingAgent",
    show_default=True,
    help="Agent installation directory (contains config.yaml and state.db).",
    type=click.Path(file_okay=False, path_type=Path),
)
@click.pass_context
def cli(ctx: click.Context, base_dir: Path) -> None:
    """TeleRad Billing Edge Agent."""
    ctx.ensure_object(dict)
    ctx.obj["base_dir"] = base_dir
    if ctx.invoked_subcommand is None:
        ctx.invoke(run)


@cli.command()
@click.pass_context
def run(ctx: click.Context) -> None:
    """Start the agent (default). Runs backfill if configured, then live CDC."""
    cfg, state, base = _resolve_paths(ctx.obj)
    setup_logging(cfg, base / "logs")
    log = logging.getLogger("agent.main")
    log.info("TeleRad Edge Agent starting. Instance: %s", cfg.instance_id)

    # Phase 1: Backfill if configured and not yet complete
    if cfg.backfill.enabled and not state.is_backfill_complete(cfg.instance_id):
        log.info(
            "Starting backfill: %s -> %s",
            cfg.backfill.from_date, cfg.backfill.to_date,
        )
        runner.run_backfill(cfg, state)
        log.info("Backfill complete. Switching to live CDC mode.")
    else:
        log.info("No pending backfill. Entering live CDC mode.")

    # Phase 2: Live CDC scheduler
    scheduler = BlockingScheduler(timezone="UTC")

    scheduler.add_job(
        runner.run_cdc_finished_reports,
        "interval",
        seconds=cfg.polling.finished_reports_seconds,
        args=[cfg, state],
        id="cdc_finished_reports",
        max_instances=1,
        misfire_grace_time=30,
    )
    scheduler.add_job(
        runner.run_cdc_reference_tables,
        "interval",
        hours=cfg.polling.reference_data_hours,
        args=[cfg, state],
        id="cdc_reference",
        max_instances=1,
    )
    scheduler.add_job(
        runner.flush_retry_queue,
        "interval",
        minutes=5,
        args=[cfg, state],
        id="retry_flush",
        max_instances=1,
    )
    scheduler.add_job(
        runner.send_heartbeat,
        "interval",
        minutes=10,
        args=[cfg],
        id="heartbeat",
        max_instances=1,
    )

    log.info(
        "Scheduler started. FinishedReport poll: every %ds | Reference: every %dh",
        cfg.polling.finished_reports_seconds,
        cfg.polling.reference_data_hours,
    )
    scheduler.start()


@cli.command()
@click.option("--from", "from_date", required=True, help="Start date YYYY-MM-DD (inclusive)")
@click.option("--to",   "to_date",   required=True, help="End date YYYY-MM-DD (inclusive)")
@click.option("--batch-size", default=1000, show_default=True)
@click.pass_context
def backfill(ctx: click.Context, from_date: str, to_date: str, batch_size: int) -> None:
    """Manual re-sync for a specific date range."""
    cfg, state, base = _resolve_paths(ctx.obj)
    setup_logging(cfg, base / "logs")
    log = logging.getLogger("agent.backfill")
    log.info("Manual backfill: %s → %s (batch %d)", from_date, to_date, batch_size)

    # Override config with CLI values for this run
    cfg.backfill.enabled    = True
    cfg.backfill.from_date  = from_date
    cfg.backfill.to_date    = to_date
    cfg.backfill.batch_size = batch_size

    # Reset backfill state so it starts fresh
    with state._conn() as conn:
        conn.execute(
            "DELETE FROM backfill_state WHERE instance_id = ?",
            (cfg.instance_id,),
        )

    runner.run_backfill(cfg, state)
    log.info("Manual backfill complete.")


@cli.command("setup-cdc")
@click.pass_context
def setup_cdc(ctx: click.Context) -> None:
    """Run the one-time CDC enablement SQL on the target SQL Server."""
    from . import setup_cdc as _setup
    cfg, _, base = _resolve_paths(ctx.obj)
    setup_logging(cfg, base / "logs")
    _setup.run(cfg)


@cli.command()
@click.pass_context
def status(ctx: click.Context) -> None:
    """Print current agent state from state.db."""
    cfg, state, _ = _resolve_paths(ctx.obj)
    click.echo(f"\n{'-'*50}")
    click.echo(f"  Instance : {cfg.instance_id}")
    click.echo(f"  Endpoint : {cfg.api_endpoint}")
    click.echo(f"{'-'*50}")

    bf = state.get_backfill(cfg.instance_id)
    if bf:
        click.echo(
            f"  Backfill : {'✅ Complete' if bf['completed'] else '⏳ In progress'}"
        )
        click.echo(f"    Range  : {bf['from_date']} → {bf['to_date']}")
        click.echo(f"    Pushed : {bf['total_pushed']} rows")

    click.echo(f"\n  CDC Cursors:")
    with state._conn() as conn:
        rows = conn.execute("SELECT * FROM cdc_cursors").fetchall()
    for row in rows:
        click.echo(f"    {row['table_name']:30s} pushed={row['rows_pushed_total']}")

    click.echo(f"{'-'*50}\n")


if __name__ == "__main__":
    cli()
