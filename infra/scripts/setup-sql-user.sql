-- =============================================================================
-- SQL Server Application User Setup Script
-- =============================================================================
-- This script creates an application user with minimal required permissions.
-- Run this script as the SQL Server administrator after initial deployment.
--
-- IMPORTANT: Replace placeholder values before executing:
--   - $(APP_USER_LOGIN): Application user login name
--   - $(APP_USER_PASSWORD): Application user password
--   - $(DATABASE_NAME): Target database name
-- =============================================================================

-- =============================================================================
-- Step 1: Create login at server level (run on master database)
-- =============================================================================
USE [master];
GO

-- Check if login exists and drop if needed (for clean re-runs)
IF EXISTS (SELECT 1 FROM sys.sql_logins WHERE name = '$(APP_USER_LOGIN)')
BEGIN
    DROP LOGIN [$(APP_USER_LOGIN)];
END
GO

-- Create the server login
CREATE LOGIN [$(APP_USER_LOGIN)]
    WITH PASSWORD = '$(APP_USER_PASSWORD)',
         DEFAULT_DATABASE = [$(DATABASE_NAME)],
         CHECK_POLICY = ON,
         CHECK_EXPIRATION = OFF;
GO

-- =============================================================================
-- Step 2: Create user in application database
-- =============================================================================
USE [$(DATABASE_NAME)];
GO

-- Check if user exists and drop if needed (for clean re-runs)
IF EXISTS (SELECT 1 FROM sys.database_principals WHERE name = '$(APP_USER_LOGIN)')
BEGIN
    DROP USER [$(APP_USER_LOGIN)];
END
GO

-- Create database user mapped to the login
CREATE USER [$(APP_USER_LOGIN)] FOR LOGIN [$(APP_USER_LOGIN)];
GO

-- =============================================================================
-- Step 3: Grant minimal required permissions
-- =============================================================================

-- Add to db_datareader role (SELECT permissions on all tables)
ALTER ROLE [db_datareader] ADD MEMBER [$(APP_USER_LOGIN)];
GO

-- Add to db_datawriter role (INSERT, UPDATE, DELETE on all tables)
ALTER ROLE [db_datawriter] ADD MEMBER [$(APP_USER_LOGIN)];
GO

-- =============================================================================
-- Step 4: Explicitly revoke dangerous permissions
-- =============================================================================

-- Revoke ability to create/alter/drop objects
DENY CREATE TABLE TO [$(APP_USER_LOGIN)];
DENY CREATE VIEW TO [$(APP_USER_LOGIN)];
DENY CREATE PROCEDURE TO [$(APP_USER_LOGIN)];
DENY CREATE FUNCTION TO [$(APP_USER_LOGIN)];
DENY ALTER TO [$(APP_USER_LOGIN)];
GO

-- Revoke ability to grant permissions
DENY ALTER ANY USER TO [$(APP_USER_LOGIN)];
DENY ALTER ANY ROLE TO [$(APP_USER_LOGIN)];
GO

-- Revoke ability to view server state
DENY VIEW SERVER STATE TO [$(APP_USER_LOGIN)];
GO

-- =============================================================================
-- Step 5: Verification queries
-- =============================================================================

-- Verify login was created
SELECT name, type_desc, is_disabled, default_database_name
FROM sys.sql_logins
WHERE name = '$(APP_USER_LOGIN)';

-- Verify user was created
SELECT dp.name AS UserName,
       dp.type_desc AS UserType,
       r.name AS RoleName
FROM sys.database_principals dp
LEFT JOIN sys.database_role_members drm ON dp.principal_id = drm.member_principal_id
LEFT JOIN sys.database_principals r ON drm.role_principal_id = r.principal_id
WHERE dp.name = '$(APP_USER_LOGIN)';

-- List effective permissions
SELECT permission_name, state_desc
FROM sys.database_permissions
WHERE grantee_principal_id = USER_ID('$(APP_USER_LOGIN)');

PRINT 'Application user setup completed successfully.';
GO
