-- =============================================================================
-- SQL Server Post-Push Script
-- =============================================================================
-- Run this AFTER every `prisma db push --schema=prisma/schema.sqlserver.prisma`
-- to create filtered unique indexes that Prisma cannot express natively.
--
-- Why: SQL Server treats multiple NULLs as duplicates in UNIQUE constraints,
-- unlike SQLite/PostgreSQL. Prisma's @@unique generates standard constraints
-- that block inserts on nullable columns. Filtered indexes (WHERE col IS NOT NULL)
-- enforce uniqueness only for non-NULL values, which is the correct behavior.
--
-- This script is idempotent — safe to run multiple times.
-- =============================================================================

-- Statuses: unique(team_id, name) only when team_id is not null
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'statuses_team_id_name_filtered_key')
  CREATE UNIQUE INDEX statuses_team_id_name_filtered_key
    ON statuses(team_id, name)
    WHERE team_id IS NOT NULL;

-- Statuses: unique(personal_scope_id, name) only when personal_scope_id is not null
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'statuses_personal_scope_id_name_filtered_key')
  CREATE UNIQUE INDEX statuses_personal_scope_id_name_filtered_key
    ON statuses(personal_scope_id, name)
    WHERE personal_scope_id IS NOT NULL;

-- Epic Requests: unique(converted_epic_id) only when converted_epic_id is not null
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'epic_requests_converted_epic_id_filtered_key')
  CREATE UNIQUE INDEX epic_requests_converted_epic_id_filtered_key
    ON epic_requests(converted_epic_id)
    WHERE converted_epic_id IS NOT NULL;
