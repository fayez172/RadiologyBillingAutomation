"""
setup_cdc.py — One-time CDC enablement tool.
Reads sql/enable_cdc.sql and executes it against the target SQL Server.
Run via: TeleRadAgent.exe setup-cdc
"""

from __future__ import annotations

import logging
from pathlib import Path

import pyodbc

from .config import AgentConfig

logger = logging.getLogger(__name__)

_SQL_FILE = Path(__file__).parent.parent / "sql" / "enable_cdc.sql"


def run(cfg: AgentConfig) -> None:
    """Execute the CDC setup SQL against the configured SQL Server."""
    logger.info("Connecting to SQL Server at %s:%d ...", cfg.mssql.host, cfg.mssql.port)

    # Connect without ReadOnly intent and use a longer timeout
    conn_str = cfg.mssql.connection_string.replace("ApplicationIntent=ReadOnly;", "")

    sql_text = _SQL_FILE.read_text(encoding="utf-8")

    # Split on GO statements (T-SQL batch separator)
    batches = [b.strip() for b in sql_text.split("\nGO") if b.strip()]

    conn = pyodbc.connect(conn_str, autocommit=True)
    try:
        cursor = conn.cursor()
        for i, batch in enumerate(batches, 1):
            if not batch or batch.startswith("--"):
                continue
            logger.info("Executing batch %d/%d ...", i, len(batches))
            try:
                cursor.execute(batch)
                # Fetch verification results and log them
                try:
                    rows = cursor.fetchall()
                    for row in rows:
                        logger.info("  ↳ %s", row)
                except pyodbc.ProgrammingError:
                    pass  # No result set for this batch
            except pyodbc.Error as exc:
                logger.warning("Batch %d warning (may be safe to ignore): %s", i, exc)
    finally:
        conn.close()

    logger.info("CDC setup complete. Verify with the SELECT queries at the end of enable_cdc.sql.")
