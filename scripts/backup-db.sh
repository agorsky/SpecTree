#!/bin/bash
# =============================================================================
# SpecTree Database Backup Script (SQLite)
# Usage: ./scripts/backup-db.sh
# =============================================================================

set -e

BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="spectree_${TIMESTAMP}.db"
DB_FILE="./packages/api/prisma/data/spectree.db"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "=========================================="
echo "SpecTree Database Backup"
echo "=========================================="
echo "Timestamp: $TIMESTAMP"
echo ""

if [ ! -f "$DB_FILE" ]; then
    echo "ERROR: Database file not found: $DB_FILE"
    exit 1
fi

echo "Creating backup..."

# SQLite backup using .backup command for consistency
sqlite3 "$DB_FILE" ".backup '${BACKUP_DIR}/${BACKUP_FILE}'"

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
ls -lht "$BACKUP_DIR"/*.db 2>/dev/null | head -5 || echo "No backups found"
