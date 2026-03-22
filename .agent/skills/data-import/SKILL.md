---
name: data-import
description: CSV/XLSX file parsing, column auto-detection, normalization, dedup rules, and mandatory instance binding for study data imports.
---

# Data Import Skill

## Purpose

Handles the ingestion of study data from Excel (.xlsx) and CSV files. Uploads are always
bound to a specific `DbInstance` (user must select or create one first).

## Mandatory Instance Selection

**Every upload MUST be associated with a `DbInstance`.**

The upload UI provides a dropdown of existing instances (or a "Create New" option).
This ensures all studies use a unified composite key: `instanceId:WorkflowID`.

This means CSV/XLSX uploads are treated identically to MSSQL syncs for dedup purposes.

## Column Auto-Detection

When parsing uploaded files, use fuzzy header matching (Levenshtein distance ≤ 2):

| Canonical Field | Accepted Header Variants |
|-----------------|--------------------------|
| `workflow_id` | Workflow ID, WorkflowID, workflow_id |
| `mrn` | MRN, PatientMRNumber, mrn |
| `procedure_raw` | Procedure, ProcedureName, procedure |
| `report_comp_time` | Report Comp Time, ReportCompletedTime, ReportCompletedTime_BDT |
| `final_rad_name` | Final Rad, Radiologist, FinalRad |
| `modality` | Modality |
| `hospital_name` | Hospital, HospitalName, Site |
| `image_count` | Image Count, ImageCount, TotalImageCount |
| `patient_name` | Patient, PatientName |

### Required Fields
- `workflow_id` — MUST be present, reject file otherwise
- `report_comp_time` — MUST be present, reject file otherwise

### Rejection
If a required column cannot be mapped, return HTTP 400:
```json
{
  "error": {
    "code": "MISSING_COLUMN",
    "message": "Required column 'workflow_id' not found",
    "details": { "detectedHeaders": ["..."], "missingColumns": ["workflow_id"] }
  }
}
```

## Parsing Pipeline

```
1. User selects DbInstance from dropdown (MANDATORY)
2. Detect file type (.xlsx or .csv)
3. Parse headers → fuzzy match to canonical fields
4. Validate required fields present
5. Stream-parse rows in batches of 500
6. For each row:
   a. Generate composite_key = `${instanceId}:${workflowId}`
   b. Parse dates (handle multiple formats)
   c. Trim all strings
   d. Check for key duplicates (same composite_key → upsert)
7. Upsert into studies table (skipDuplicates on composite_key)
8. Run duplicate study detection (fuzzy: hospital + modality + procedure + patient)
9. Update UploadJob stats: total_rows, parsed_rows, mapped_rows, unmapped_rows, duplicate_rows
10. Trigger mapping engine (async)
```

## Duplicate Study Detection (Post-Import)

After rows are inserted, run a duplicate detection pass:

```
Duplicate criteria:
  - Same hospital_name
  - Same modality
  - Similar procedure_raw (Levenshtein ≤ 3)
  - Similar patient_name (Levenshtein ≤ 2)
```

- Flag matches: set `is_duplicate = true`, assign `duplicate_group_id`
- Duplicates are **excluded from invoices** by default
- Present in a review queue for manual confirmation/dismissal

## Date Parsing

Accept these formats:
- ISO 8601: `2026-01-15T10:30:00`
- US: `01/15/2026 10:30 AM`
- BD: `15-01-2026 10:30`
- Excel serial numbers

## Libraries

- **SheetJS** (`xlsx` package) for parsing
- Stream mode for large files (100K+ rows)
- Memory limit: Keep max 500 rows in memory at once
