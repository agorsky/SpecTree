#!/bin/bash
# =============================================================================
# SpecTree Database Restore Script (SQLite)
# Usage: ./scripts/restore-db.sh <backup_file>
# =============================================================================

set -e

BACKUP_FILE="$1"
DB_FILE="./packages/api/prisma/data/spectree.db"
DB_DIR="./packages/api/prisma/data"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file>"
    echo ""
    echo "Available backups:"
    ls -lht ./backups/*.db 2>/dev/null || echo "No backups found in ./backups/"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "ERROR: Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "=========================================="
echo "SpecTree Database Restore"
echo "=========================================="
echo "Backup file: $BACKUP_FILE"
echo "Target: $DB_FILE"
echo ""
echo "WARNING: This will REPLACE the current database!"
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

# Create data directory if it doesn't exist
mkdir -p "$DB_DIR"

# Backup current database if it exists
if [ -f "$DB_FILE" ]; then
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    echo "Backing up current database to ${DB_FILE}.before_restore_${TIMESTAMP}"
    cp "$DB_FILE" "${DB_FILE}.before_restore_${TIMESTAMP}"
fi

echo "Restoring database..."
cp "$BACKUP_FILE" "$DB_FILE"

echo ""
echo "=========================================="
echo "Restore completed successfully!"
echo "=========================================="
