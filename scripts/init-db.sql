-- =============================================================================
-- Database Initialization Script
-- Creates the spectree database and initial schema
-- =============================================================================

-- Create database if it doesn't exist
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'spectree')
BEGIN
    CREATE DATABASE spectree;
    PRINT 'Database spectree created.';
END
ELSE
BEGIN
    PRINT 'Database spectree already exists.';
END
GO

USE spectree;
GO

-- =============================================================================
-- Add your schema creation scripts below
-- =============================================================================

-- Example: Create a sample table (replace with your actual schema)
-- IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Users')
-- BEGIN
--     CREATE TABLE Users (
--         Id INT IDENTITY(1,1) PRIMARY KEY,
--         Email NVARCHAR(255) NOT NULL UNIQUE,
--         DisplayName NVARCHAR(255) NOT NULL,
--         CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
--         UpdatedAt DATETIME2 DEFAULT GETUTCDATE()
--     );
--     PRINT 'Table Users created.';
-- END
-- GO

PRINT 'Database initialization complete.';
GO
