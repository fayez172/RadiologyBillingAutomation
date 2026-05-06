"""
cdc_reader.py — All MSSQL reads.
Handles both CDC live mode (LSN-based) and historical backfill (offset-based).
"""

from __future__ import annotations

import logging
from contextlib import contextmanager
from typing import Generator, Optional

import pyodbc

from .config import AgentConfig

logger = logging.getLogger(__name__)

# Maps __$operation integer to a human-readable string
OPERATION_MAP = {1: "delete", 2: "insert", 4: "update"}


@contextmanager
def get_connection(cfg: AgentConfig, database: str) -> Generator[pyodbc.Connection, None, None]:
    """Open a read-only MSSQL connection to the given database."""
    conn_str = (
        f"DRIVER={{{cfg.mssql.odbc_driver}}};"
        f"SERVER={cfg.mssql.host},{cfg.mssql.port};"
        f"DATABASE={database};"
        f"UID={cfg.mssql.user};"
        f"PWD={cfg.mssql.password};"
        f"TrustServerCertificate=yes;"
        f"ApplicationIntent=ReadOnly;"
        f"Connection Timeout={cfg.mssql.connect_timeout};"
    )
    conn = pyodbc.connect(conn_str, timeout=cfg.mssql.connect_timeout)
    conn.timeout = cfg.mssql.query_timeout
    try:
        yield conn
    finally:
        conn.close()


# ── LSN Helpers ────────────────────────────────────────────────────────────────

def get_max_lsn(conn: pyodbc.Connection) -> bytes:
    row = conn.execute("SELECT sys.fn_cdc_get_max_lsn()").fetchone()
    if row is None or row[0] is None:
        return None
    return bytes(row[0])


def get_min_lsn(conn: pyodbc.Connection, capture_instance: str) -> bytes:
    """Returns the oldest LSN available in the CDC capture table."""
    row = conn.execute(
        "SELECT sys.fn_cdc_get_min_lsn(?)", capture_instance
    ).fetchone()
    return bytes(row[0])


def increment_lsn(conn: pyodbc.Connection, lsn: bytes) -> bytes:
    """Returns the next LSN after the given one, to avoid re-reading the same boundary."""
    row = conn.execute("SELECT sys.fn_cdc_increment_lsn(?)", lsn).fetchone()
    if row is None or row[0] is None:
        return lsn
    return bytes(row[0])


# ── CDC Live Mode ──────────────────────────────────────────────────────────────

def fetch_finished_report_changes(
    conn: pyodbc.Connection,
    from_lsn: bytes,
    to_lsn: bytes,
    radiology_db: str,
    owner_ids: list[int],
) -> list[dict]:
    """
    Fetch net changes to FinishedReport between two LSNs.
    Uses 'all with mask' so multiple changes to the same row are collapsed
    into a single final-state row automatically.
    """
    sql = f"""
        SELECT
            fr.__$operation         AS op,
            fr.WorkflowID,
            fr.PatientMRNumber      AS mrn,
            pr.Name                 AS procedure_name,
            CONVERT(VARCHAR(30),
                fr.ReportCompletedTime AT TIME ZONE 'UTC'
                    AT TIME ZONE 'Bangladesh Standard Time',
                127
            )                       AS report_completed_at,
            ss.Name                 AS hospital_name,
            COALESCE(
                r.DisplayName,
                LTRIM(RTRIM(CONCAT(r.FirstName, ' ', r.MiddleName, ' ', r.LastName)))
            )                       AS radiologist,
            m.DisplayName           AS modality,
            fr.TotalImageCount      AS image_count,
            fr.ReportedByUserID,
            fr.Add1Read1RadiologistID,
            fr.Add2Read1RadiologistID,
            fr.Add3Read1RadiologistID,
            fr.ForModalityID,
            fr.ForProcedureID,
            fr.StudySourceID,
            LTRIM(RTRIM(CONCAT(
                fr.PatientPrefix, ' ', fr.PatientFirstName, ' ',
                fr.PatientMiddleName, ' ', fr.PatientLastName, ' ',
                fr.PatientSuffix
            )))                     AS patient_name
        FROM cdc.fn_cdc_get_net_changes_dbo_FinishedReport(?, ?, 'all with mask') AS fr
        LEFT JOIN [{radiology_db}].dbo.[Procedure]  pr ON pr.ID = fr.ForProcedureID
        LEFT JOIN [{radiology_db}].dbo.Radiologist   r  ON r.ID  = fr.ReportedByUserID
        LEFT JOIN [{radiology_db}].dbo.Modality      m  ON m.ID  = fr.ForModalityID
        LEFT JOIN [{radiology_db}].dbo.StudySource   ss ON ss.ID = fr.StudySourceID
        WHERE ss.OwnerID IN ({",".join(map(str, owner_ids))})
        ORDER BY fr.__$start_lsn
    """
    rows = conn.execute(sql, from_lsn, to_lsn).fetchall()
    return [_row_to_study(r) for r in rows]


def _row_to_study(row) -> dict:
    return {
        "op": OPERATION_MAP.get(row.op, "unknown"),
        "workflow_id": row.WorkflowID,
        "mrn": row.mrn,
        "procedure_name": row.procedure_name,
        "report_completed_at": row.report_completed_at,
        "hospital_name": row.hospital_name,
        "radiologist": row.radiologist,
        "modality": row.modality,
        "image_count": row.image_count,
        "patient_name": (row.patient_name or "").strip(),
        "reported_by_remote_id": row.ReportedByUserID,
        "add1_rad_remote_id": row.Add1Read1RadiologistID,
        "add2_rad_remote_id": row.Add2Read1RadiologistID,
        "add3_rad_remote_id": row.Add3Read1RadiologistID,
        "modality_remote_id": row.ForModalityID,
        "procedure_remote_id": row.ForProcedureID,
        "study_source_remote_id": row.StudySourceID,
    }


# ── Reference Table CDC ────────────────────────────────────────────────────────

def fetch_reference_changes(
    conn: pyodbc.Connection,
    table_name: str,
    capture_instance: str,
    from_lsn: bytes,
    to_lsn: bytes,
    owner_ids: list[int],
) -> list[dict]:
    """Generic CDC fetch for reference tables (Radiologist, Modality, etc.)."""
    sql = f"""
        SELECT *
        FROM cdc.fn_cdc_get_net_changes_{capture_instance}(?, ?, 'all with mask')
        ORDER BY __$start_lsn
    """
    cursor = conn.execute(sql, from_lsn, to_lsn)
    rows = cursor.fetchall()
    
    # Metadata columns are usually [0]start_lsn, [1]operation, [2]update_mask
    # Data columns follow thereafter.
    col_names = [c[0] for c in cursor.description]
    data_col_names = col_names[3:]
    
    results = []
    owner_id_idx = None
    if "OwnerID" in data_col_names:
        owner_id_idx = data_col_names.index("OwnerID")
    elif "owner_id" in data_col_names:
        owner_id_idx = data_col_names.index("owner_id")

    for r in rows:
        data = dict(zip(data_col_names, r[3:]))
        if owner_id_idx is not None:
            oid = r[3 + owner_id_idx]
            if oid not in owner_ids:
                continue
        results.append({
            "op": OPERATION_MAP.get(r[1], "unknown"),
            **data,
        })
    return results


# ── Historical Backfill ────────────────────────────────────────────────────────

def fetch_backfill_batch(
    conn: pyodbc.Connection,
    from_date: str,
    to_date: str,
    offset: int,
    batch_size: int,
    radiology_db: str,
    owner_ids: list[int],
) -> list[dict]:
    """
    Direct paginated query on FinishedReport for historical backfill.
    Does NOT use CDC — reads the live table directly.
    'op' is always 'insert' (we treat all historical rows as new inserts).
    """
    sql = f"""
        SELECT
            fr.WorkflowID,
            fr.PatientMRNumber      AS mrn,
            pr.Name                 AS procedure_name,
            CONVERT(VARCHAR(30),
                fr.ReportCompletedTime AT TIME ZONE 'UTC'
                    AT TIME ZONE 'Bangladesh Standard Time',
                127
            )                       AS report_completed_at,
            ss.Name                 AS hospital_name,
            COALESCE(
                r.DisplayName,
                LTRIM(RTRIM(CONCAT(r.FirstName, ' ', r.MiddleName, ' ', r.LastName)))
            )                       AS radiologist,
            m.DisplayName           AS modality,
            fr.TotalImageCount      AS image_count,
            fr.ReportedByUserID,
            fr.Add1Read1RadiologistID,
            fr.Add2Read1RadiologistID,
            fr.Add3Read1RadiologistID,
            fr.ForModalityID,
            fr.ForProcedureID,
            fr.StudySourceID,
            LTRIM(RTRIM(CONCAT(
                fr.PatientPrefix, ' ', fr.PatientFirstName, ' ',
                fr.PatientMiddleName, ' ', fr.PatientLastName, ' ',
                fr.PatientSuffix
            )))                     AS patient_name
        FROM dbo.FinishedReport fr
        LEFT JOIN [{radiology_db}].dbo.[Procedure]  pr ON pr.ID = fr.ForProcedureID
        LEFT JOIN [{radiology_db}].dbo.Radiologist   r  ON r.ID  = fr.ReportedByUserID
        LEFT JOIN [{radiology_db}].dbo.Modality      m  ON m.ID  = fr.ForModalityID
        LEFT JOIN [{radiology_db}].dbo.StudySource   ss ON ss.ID = fr.StudySourceID
        WHERE fr.ReportCompletedTime >= CAST(? AS DATE)
          AND fr.ReportCompletedTime <  DATEADD(DAY, 1, CAST(? AS DATE))
          AND ss.OwnerID IN ({",".join(map(str, owner_ids))})
        ORDER BY fr.ReportCompletedTime, fr.WorkflowID
        OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
    """
    logger.info("Fetching backfill batch: from=%s, to=%s, offset=%d, size=%d", from_date, to_date, offset, batch_size)
    rows = conn.execute(sql, from_date, to_date, offset, batch_size).fetchall()
    return [
        {
            "op": "insert",
            "workflow_id": r.WorkflowID,
            "mrn": r.mrn,
            "procedure_name": r.procedure_name,
            "report_completed_at": r.report_completed_at,
            "hospital_name": r.hospital_name,
            "radiologist": r.radiologist,
            "modality": r.modality,
            "image_count": r.image_count,
            "patient_name": (r.patient_name or "").strip(),
            "reported_by_remote_id": r.ReportedByUserID,
            "add1_rad_remote_id": r.Add1Read1RadiologistID,
            "add2_rad_remote_id": r.Add2Read1RadiologistID,
            "add3_rad_remote_id": r.Add3Read1RadiologistID,
            "modality_remote_id": r.ForModalityID,
            "procedure_remote_id": r.ForProcedureID,
            "study_source_remote_id": r.StudySourceID,
        }
        for r in rows
    ]


# ── Reference Data Fetch (for initial load / ref refresh) ─────────────────────

def fetch_radiologists(conn: pyodbc.Connection, owner_ids: list[int]) -> list[dict]:
    rows = conn.execute(
        f"SELECT ID, DisplayName, FirstName, MiddleName, LastName, Active FROM dbo.Radiologist WHERE OwnerID IN ({','.join(map(str, owner_ids))})"
    ).fetchall()
    return [dict(zip([c[0] for c in conn.cursor().description or []], r)) for r in rows]


def fetch_modalities(conn: pyodbc.Connection, owner_ids: list[int]) -> list[dict]:
    rows = conn.execute(
        f"SELECT ID, DisplayName, Code, Active FROM dbo.Modality WHERE OwnerID IN ({','.join(map(str, owner_ids))})"
    ).fetchall()
    return [{"id": r[0], "display_name": r[1], "code": r[2], "active": r[3]} for r in rows]


def fetch_hospitals(conn: pyodbc.Connection, owner_ids: list[int]) -> list[dict]:
    rows = conn.execute(
        f"SELECT ID, Name, Active FROM dbo.StudySource WHERE OwnerID IN ({','.join(map(str, owner_ids))})"
    ).fetchall()
    return [{"id": r[0], "name": r[1], "active": r[2]} for r in rows]
