-- =============================================================================
-- TeleRad Edge Agent — CDC Setup Script
-- Run ONCE on-site with sysadmin / db_owner credentials.
-- SQL Server Enterprise edition required.
-- =============================================================================

-- Step 1: Enable CDC on the Reporting Database (FinishedReport lives here)
USE RADSpaRISReportingDB;
GO

EXEC sys.sp_cdc_enable_db;
GO

EXEC sys.sp_cdc_enable_table
    @source_schema        = N'dbo',
    @source_name          = N'FinishedReport',
    @role_name            = NULL,
    @supports_net_changes = 1;   -- Required for fn_cdc_get_net_changes_*
GO

-- Step 2: Enable CDC on the Radiology Database (reference tables live here)
USE RADSpaRISRadiologyDB;
GO

EXEC sys.sp_cdc_enable_db;
GO

EXEC sys.sp_cdc_enable_table
    @source_schema        = N'dbo',
    @source_name          = N'Radiologist',
    @role_name            = NULL,
    @supports_net_changes = 1;
GO

EXEC sys.sp_cdc_enable_table
    @source_schema        = N'dbo',
    @source_name          = N'Modality',
    @role_name            = NULL,
    @supports_net_changes = 1;
GO

EXEC sys.sp_cdc_enable_table
    @source_schema        = N'dbo',
    @source_name          = N'StudySource',
    @role_name            = NULL,
    @supports_net_changes = 1;
GO

EXEC sys.sp_cdc_enable_table
    @source_schema        = N'dbo',
    @source_name          = N'Procedure',
    @role_name            = NULL,
    @supports_net_changes = 1;
GO

-- Step 3: Set CDC retention to 7 days (10080 minutes)
--         Default is 3 days; 7 days gives recovery window if agent goes offline.
EXEC sys.sp_cdc_change_job
    @job_type  = N'cleanup',
    @retention = 10080;
GO

-- Step 4: Verify CDC is active
SELECT
    name         AS database_name,
    is_cdc_enabled
FROM sys.databases
WHERE name IN ('RADSpaRISReportingDB', 'RADSpaRISRadiologyDB');

SELECT
    s.name  AS schema_name,
    t.name  AS table_name,
    t.is_tracked_by_cdc
FROM sys.tables t
JOIN sys.schemas s ON s.schema_id = t.schema_id
WHERE t.is_tracked_by_cdc = 1
ORDER BY s.name, t.name;
