#!/bin/bash
# =============================================================================
# SpecTree Database Restore Script
# Usage: ./scripts/restore-db.sh <backup_file>
# Example: ./scripts/restore-db.sh ./backups/spectree_20260128_120000.bak
# =============================================================================

set -e

BACKUP_FILE="$1"
CONTAINER_NAME="spectree-sql"
SA_PASSWORD="LocalDev@Password123"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file>"
    echo ""
    echo "Available backups:"
    ls -lht ./backups/*.bak 2>/dev/null || echo "No backups found in ./backups/"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "ERROR: Backup file not found: $BACKUP_FILE"
    exit 1
fi

BACKUP_FILENAME=$(basename "$BACKUP_FILE")

echo "=========================================="
echo "SpecTree Database Restore"
echo "=========================================="
echo "Backup file: $BACKUP_FILE"
echo "Container: $CONTAINER_NAME"
echo ""
echo "WARNING: This will REPLACE the current database!"
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "ERROR: Container $CONTAINER_NAME is not running!"
    exit 1
fi

echo ""
echo "Copying backup to container..."
docker cp "$BACKUP_FILE" "${CONTAINER_NAME}:/var/opt/mssql/data/${BACKUP_FILENAME}"

echo "Setting database to single user mode..."
docker exec "$CONTAINER_NAME" /opt/mssql-tools18/bin/sqlcmd \
    -S localhost \
    -U sa \
    -P "$SA_PASSWORD" \
    -C \
    -Q "
        IF EXISTS (SELECT 1 FROM sys.databases WHERE name = 'spectree')
        BEGIN
            ALTER DATABASE [spectree] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
        END
    " 2>/dev/null || true

echo "Restoring database..."
docker exec "$CONTAINER_NAME" /opt/mssql-tools18/bin/sqlcmd \
    -S localhost \
    -U sa \
    -P "$SA_PASSWORD" \
    -C \
    -Q "
        RESTORE DATABASE [spectree] 
        FROM DISK = N'/var/opt/mssql/data/${BACKUP_FILENAME}' 
        WITH REPLACE, RECOVERY,
        STATS = 10
    "

echo "Setting database back to multi user mode..."
docker exec "$CONTAINER_NAME" /opt/mssql-tools18/bin/sqlcmd \
    -S localhost \
    -U sa \
    -P "$SA_PASSWORD" \
    -C \
    -Q "ALTER DATABASE [spectree] SET MULTI_USER"

# Clean up backup file in container
docker exec "$CONTAINER_NAME" rm -f "/var/opt/mssql/data/${BACKUP_FILENAME}"

echo ""
echo "=========================================="
echo "Restore completed successfully!"
echo "=========================================="
