---
name: mssql-integration
description: Rules and patterns for connecting to remote MS SQL Server instances in READ-ONLY mode, fetching study data, local caching via PostgreSQL, and syncing strategies.
---

# MSSQL Integration Skill

## Purpose

This skill governs all interactions with remote MS SQL Server production databases. The system connects to multiple MSSQL instances to fetch radiology study data for billing purposes.

**All data is synced into local PostgreSQL.** The app never queries MSSQL on the fly for billing operations.

## Architecture: Local Caching Strategy

```
┌──────────────────┐     sync      ┌──────────────────┐     query     ┌──────────────┐
│  MSSQL Prod #1   │────────────▶  │                  │◀────────────  │              │
│  MSSQL Prod #2   │────────────▶  │   PostgreSQL     │               │   Next.js    │
│  MSSQL Prod #N   │────────────▶  │   (local cache)  │──────────────▶│   App        │
│  CSV/XLSX Upload │────────────▶  │                  │               │              │
└──────────────────┘               └──────────────────┘               └──────────────┘
```

### Rules:
1. **MSSQL is only touched during SYNC** — triggered manually or on schedule
2. **All billing/mapping/invoicing** queries the local PostgreSQL only
3. **Incremental sync** using `last_synced_at` — only fetch new/updated studies
4. **Reference data sync** — radiologists, modalities, hospitals are also cached locally
5. **Reference data refresh** — on each sync, update reference tables too

## READ-ONLY Enforcement (CRITICAL)

**Every MSSQL connection MUST use `readOnlyIntent: true`.** This is non-negotiable.

```typescript
// src/lib/mssql.ts — Connection config template
const config: sql.config = {
  server: instance.ip,
  port: instance.port,
  user: decrypt(instance.password_encrypted), // decrypted at runtime
  password: decryptedPassword,
  database: instance.reporting_db,
  options: {
    readOnlyIntent: true,    // ← CRITICAL: Always true
    encrypt: false,          // Internal network
    trustServerCertificate: true,
    connectTimeout: 15000,
    requestTimeout: 60000,
  },
  pool: {
    max: 5,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};
```

## Canonical Fetch Query

The query joins across TWO databases on the same server:
- **Reporting DB** (e.g. `RADSpaRISReportingDB`): Contains `FinishedReport`
- **Radiology DB** (e.g. `RADSpaRISRadiologyDB`): Contains `Procedure`, `Radiologist`, `Modality`, `StudySource`

```sql
SELECT
    fr.WorkflowID,
    fr.PatientMRNumber           AS MRN,
    pr.Name                      AS ProcedureName,
    fr.ReportCompletedTime AT TIME ZONE 'UTC'
                       AT TIME ZONE 'Bangladesh Standard Time' AS ReportCompletedTime_BDT,
    ss.Name                      AS HospitalName,
    COALESCE(r.DisplayName, LTRIM(RTRIM(CONCAT(r.FirstName, ' ', r.MiddleName, ' ', r.LastName)))) AS Radiologist,
    m.DisplayName                AS Modality,
    fr.TotalImageCount           AS ImageCount,
    LTRIM(RTRIM(CONCAT(
        fr.PatientPrefix, ' ',
        fr.PatientFirstName, ' ',
        fr.PatientMiddleName, ' ',
        fr.PatientLastName, ' ',
        fr.PatientSuffix
    )))                          AS PatientName
FROM {REPORTING_DB}.dbo.FinishedReport fr
LEFT JOIN {RADIOLOGY_DB}.dbo.[Procedure]     pr ON pr.ID = fr.ForProcedureID
LEFT JOIN {RADIOLOGY_DB}.dbo.Radiologist     r  ON r.ID  = fr.ReportedByUserID
LEFT JOIN {RADIOLOGY_DB}.dbo.Modality        m  ON m.ID  = fr.ForModalityID
LEFT JOIN {RADIOLOGY_DB}.dbo.StudySource     ss ON ss.ID = fr.StudySourceID
WHERE fr.ReportCompletedTime >= @dateFrom
  AND fr.ReportCompletedTime < DATEADD(DAY, 1, CAST(@dateTo AS date))
ORDER BY fr.ReportCompletedTime;
```

**Note:** `{REPORTING_DB}` and `{RADIOLOGY_DB}` are replaced with actual DB names from the `DbInstance` record. They vary slightly across instances.

## Schema Differences

| Table | Column Notes |
|-------|-------------|
| `Modality` | Uses `DisplayName` (no `Name` column). Has `Code` field. |
| `StudySource` | Uses `Name` (no `DisplayName` column). |
| `Procedure` | Uses `Name`. Has `ParentModalityID` linking to Modality. |
| `Radiologist` | Has both `DisplayName` and `FirstName`/`MiddleName`/`LastName`. |
| `FinishedReport` | Primary key: `WorkflowID` (bigint). Contains patient info, image count. |

## Sync Algorithm

1. Read `DbInstance` record → decrypt password
2. Connect with `readOnlyIntent: true`
3. **Sync reference data** (radiologists, modalities, hospitals) → local cache
4. Fetch studies using `last_synced_at` as `@dateFrom` (incremental)
5. For each row, compute `composite_key = instanceId:WorkflowID`
6. Upsert into `Study` table using `composite_key` as unique constraint
7. Batch inserts: 500 rows per `createMany({ skipDuplicates: true })`
8. Run duplicate study detection (fuzzy: hospital + modality + procedure + patient)
9. Trigger mapping engine (async BullMQ job)
10. Update `DbInstance.last_synced_at`

## New Study Detection

To check for new arrivals without full sync:
```sql
SELECT COUNT(*) FROM {REPORTING_DB}.dbo.FinishedReport
WHERE ReportCompletedTime > @lastSyncedAt
```

This lightweight query can run on a schedule (e.g. every 15 min) to show a
"X new studies available" badge in the UI without triggering a full sync.

## Additional Reference Queries

To fetch the current radiologist list from an instance:
```sql
SELECT ID, DisplayName, Active FROM {RADIOLOGY_DB}.dbo.Radiologist WHERE Active = 1
```

To fetch modalities:
```sql
SELECT ID, DisplayName, Code, Active FROM {RADIOLOGY_DB}.dbo.Modality WHERE Active = 1
```

To fetch hospitals/study sources:
```sql
SELECT ID, Name, Active FROM {RADIOLOGY_DB}.dbo.StudySource WHERE Active = 1
```
