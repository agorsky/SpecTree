#!/bin/bash
# =============================================================================
# SpecTree Database Backup Script
# Usage: ./scripts/backup-db.sh
# =============================================================================

set -e

BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="spectree_${TIMESTAMP}.bak"
CONTAINER_NAME="spectree-sql"
SA_PASSWORD="LocalDev@Password123"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "=========================================="
echo "SpecTree Database Backup"
echo "=========================================="
echo "Timestamp: $TIMESTAMP"
echo "Container: $CONTAINER_NAME"
echo ""

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "ERROR: Container $CONTAINER_NAME is not running!"
    exit 1
fi

echo "Creating backup..."

# Run sqlcmd from a separate tools container, connecting to the SQL server
# The backup file will be created inside the SQL Server container's data directory
docker run --rm \
    --network=container:${CONTAINER_NAME} \
    mcr.microsoft.com/mssql-tools:latest \
    /opt/mssql-tools/bin/sqlcmd \
    -S localhost \
    -U sa \
    -P "$SA_PASSWORD" \
    -C \
    -Q "
        BACKUP DATABASE [spectree] 
        TO DISK = N'/var/opt/mssql/data/${BACKUP_FILE}' 
        WITH FORMAT, INIT, COMPRESSION,
        NAME = N'spectree-Full Database Backup',
        SKIP, NOREWIND, NOUNLOAD, STATS = 10
    "

# Copy backup from container to host
echo "Copying backup to host..."
docker cp "${CONTAINER_NAME}:/var/opt/mssql/data/${BACKUP_FILE}" "${BACKUP_DIR}/${BACKUP_FILE}"

# Remove backup from container (keep host copy only)
docker exec "$CONTAINER_NAME" rm -f "/var/opt/mssql/data/${BACKUP_FILE}"

# Show backup info
BACKUP_SIZE=$(ls -lh "${BACKUP_DIR}/${BACKUP_FILE}" | awk '{print $5}')
echo ""
echo "=========================================="
echo "Backup completed successfully!"
echo "=========================================="
echo "File: ${BACKUP_DIR}/${BACKUP_FILE}"
echo "Size: ${BACKUP_SIZE}"
echo ""

# List recent backups
echo "Recent backups:"
ls -lht "$BACKUP_DIR"/*.bak 2>/dev/null | head -5 || echo "No backups found"
