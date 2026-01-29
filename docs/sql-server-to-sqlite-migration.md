# SpecTree Database Migration: SQL Server → SQLite

## Executive Summary

This document provides comprehensive analysis and requirements for migrating SpecTree from SQL Server (Azure SQL Edge) to SQLite. The goal is to simplify local development, reduce operational complexity, eliminate licensing concerns, and prepare for containerized deployment to Azure.

---

## 1. Current State Analysis

### 1.1 Technology Stack

| Component | Current |
|-----------|---------|
| Database | SQL Server (Azure SQL Edge) |
| ORM | Prisma v6.3.0 |
| API Framework | Fastify |
| Runtime | Node.js |
| Container | Docker with `mcr.microsoft.com/azure-sql-edge:latest` |

### 1.2 Database Configuration

**Connection String Format (SQL Server):**
```
sqlserver://localhost:1433;database=spectree;user=sa;password=LocalDev@Password123;encrypt=true;trustServerCertificate=true
```

**Key Files:**
- Schema: `packages/api/prisma/schema.prisma`
- DB Client: `packages/api/src/lib/db.ts`
- Seed Script: `packages/api/prisma/seed.ts`
- Docker Compose: `docker-compose.yml`
- Backup Script: `scripts/backup-db.sh`
- Restore Script: `scripts/restore-db.sh`
- Init SQL: `scripts/init-db.sql`

### 1.3 Current Schema (8 Tables)

```prisma
// Current provider
datasource db {
  provider = "sqlserver"
  url      = env("DATABASE_URL")
}
```

**Models:**

| Model | Primary Key | Notes |
|-------|-------------|-------|
| `HealthCheck` | `Int @id @default(autoincrement())` | Test table |
| `Team` | `String @id @default(uuid()) @db.UniqueIdentifier` | UUID PK |
| `User` | `String @id @default(uuid()) @db.UniqueIdentifier` | UUID PK |
| `Membership` | `String @id @default(uuid()) @db.UniqueIdentifier` | Join table, UUID PK |
| `Project` | `String @id @default(uuid()) @db.UniqueIdentifier` | UUID PK |
| `Status` | `String @id @default(uuid()) @db.UniqueIdentifier` | UUID PK |
| `Feature` | `String @id @default(uuid()) @db.UniqueIdentifier` | UUID PK |
| `Task` | `String @id @default(uuid()) @db.UniqueIdentifier` | UUID PK |

### 1.4 SQL Server-Specific Features Currently Used

| Feature | Usage | SQLite Compatibility |
|---------|-------|---------------------|
| `@db.UniqueIdentifier` | UUID primary keys | ✅ Use `String` (SQLite stores as TEXT) |
| `@db.NVarChar(n)` | Unicode strings | ✅ Use `String` (SQLite TEXT is Unicode) |
| `@db.VarChar(n)` | ASCII strings | ✅ Use `String` |
| `@db.Text` | Long text | ✅ Use `String` |
| `@db.Float` | Floating point | ✅ Use `Float` |
| `@default(uuid())` | Auto-generate UUIDs | ✅ Supported in Prisma for SQLite |
| `@default(autoincrement())` | Auto-increment | ✅ Native SQLite support |
| `@updatedAt` | Auto-update timestamp | ✅ Prisma handles this |
| Cascade deletes | `onDelete: Cascade` | ✅ Supported with `PRAGMA foreign_keys = ON` |
| `onDelete: NoAction` | Prevent cascade | ✅ Supported |

### 1.5 Raw SQL Usage

**Only ONE raw query found** in `packages/api/src/index.ts`:
```typescript
await prisma.$queryRaw`SELECT 1 as result`;
```
This is a simple health check query that is fully SQLite compatible.

### 1.6 Backup/Restore Scripts

Current scripts use SQL Server-specific commands:
- `BACKUP DATABASE` T-SQL command
- `RESTORE DATABASE` T-SQL command
- `sqlcmd` CLI tool

**These must be replaced** with SQLite-appropriate methods (file copy).

---

## 2. Target State

### 2.1 SQLite Configuration

**New Connection String Format:**
```
file:./data/spectree.db
```

**Target Schema Provider:**
```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

### 2.2 Benefits of SQLite for This Use Case

- ✅ Zero licensing cost
- ✅ No separate container/server required
- ✅ File-based = trivial backups (just copy the file)
- ✅ Perfect for low-concurrency workloads
- ✅ Excellent Prisma support
- ✅ Containerizes easily (just mount a volume)
- ✅ Fast local development
- ✅ Single-file deployment

### 2.3 Azure Deployment Strategy

For Azure Container Apps:
1. Mount Azure File Share as persistent volume
2. Store SQLite database file on the mounted volume
3. Application reads/writes directly to the file

---

## 3. Migration Requirements

### 3.1 Schema Changes Required

The Prisma schema must be updated to remove SQL Server-specific type annotations:

| Current (SQL Server) | Target (SQLite) |
|---------------------|-----------------|
| `@db.UniqueIdentifier` | Remove (use default String) |
| `@db.NVarChar(255)` | Remove (use default String) |
| `@db.VarChar(10)` | Remove (use default String) |
| `@db.Text` | Remove (use default String) |
| `@db.Float` | Remove (use default Float) |
| `provider = "sqlserver"` | `provider = "sqlite"` |

**Example transformation:**

```prisma
// BEFORE (SQL Server)
model User {
  id           String   @id @default(uuid()) @db.UniqueIdentifier
  email        String   @unique @db.NVarChar(255)
  name         String   @db.NVarChar(255)
  passwordHash String   @map("password_hash") @db.NVarChar(255)
  // ...
}

// AFTER (SQLite)
model User {
  id           String   @id @default(uuid())
  email        String   @unique
  name         String
  passwordHash String   @map("password_hash")
  // ...
}
```

### 3.2 Files to Modify

| File | Changes Required |
|------|-----------------|
| `packages/api/prisma/schema.prisma` | Change provider, remove `@db.*` annotations |
| `packages/api/.env` | Update `DATABASE_URL` |
| `packages/api/.env.example` | Update `DATABASE_URL` example |
| `docker-compose.yml` | Remove SQL Server service, add volume for SQLite |
| `scripts/backup-db.sh` | Replace with file copy |
| `scripts/restore-db.sh` | Replace with file copy |
| `scripts/init-db.sql` | Delete (not needed for SQLite) |
| `packages/api/src/lib/db.ts` | No changes needed (Prisma handles it) |
| `packages/api/prisma/seed.ts` | No changes needed |
| `packages/api/src/index.ts` | No changes needed (raw query is compatible) |

### 3.3 Files to Delete

- `scripts/init-db.sql` - Not needed for SQLite
- `infra/scripts/setup-sql-user.sql` - Not applicable
- `docker-compose.improved.yml` - Needs full rewrite or deletion

### 3.4 New Files to Create

| File | Purpose |
|------|---------|
| `packages/api/data/.gitkeep` | Directory for SQLite database file |
| `scripts/backup-db.sh` (rewrite) | Simple file copy backup |
| `scripts/restore-db.sh` (rewrite) | Simple file copy restore |

---

## 4. Implementation Checklist

### Phase 1: Schema Migration
- [ ] Create backup of current SQL Server schema
- [ ] Modify `schema.prisma` to use SQLite provider
- [ ] Remove all `@db.*` type annotations
- [ ] Create `packages/api/data/` directory with `.gitkeep`
- [ ] Update `.env` with SQLite connection string
- [ ] Update `.env.example` with SQLite connection string
- [ ] Add `packages/api/data/*.db` to `.gitignore`

### Phase 2: Database Setup
- [ ] Run `npx prisma generate` to regenerate client
- [ ] Run `npx prisma db push` to create SQLite schema
- [ ] Run `npm run db:seed` to seed data
- [ ] Verify all CRUD operations work

### Phase 3: Docker Updates
- [ ] Remove `sqlserver` service from `docker-compose.yml`
- [ ] Remove `sqlserver-init` service from `docker-compose.yml`
- [ ] Remove `sqlserver-data` volume
- [ ] Update `api` service environment variables
- [ ] Add volume mount for SQLite data directory
- [ ] Update `api` service to not depend on sqlserver

### Phase 4: Script Updates
- [ ] Rewrite `scripts/backup-db.sh` for SQLite
- [ ] Rewrite `scripts/restore-db.sh` for SQLite
- [ ] Delete `scripts/init-db.sql`
- [ ] Delete `infra/scripts/setup-sql-user.sql`
- [ ] Delete or rewrite `docker-compose.improved.yml`

### Phase 5: Testing
- [ ] Run all existing tests
- [ ] Test API endpoints manually
- [ ] Test backup script
- [ ] Test restore script
- [ ] Test Docker containerized deployment
- [ ] Verify data persistence across container restarts

### Phase 6: Documentation
- [ ] Update README.md with new setup instructions
- [ ] Update any database-related documentation
- [ ] Document backup/restore procedures

---

## 5. New Schema (Complete)

```prisma
// Prisma Schema for SpecTree API
// Documentation: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

// =============================================================================
// Note: SQLite doesn't support native enums, so we use String fields with
// application-level validation for: MembershipRole, StatusCategory
// Valid MembershipRole values: 'admin', 'member', 'guest'
// Valid StatusCategory values: 'backlog', 'unstarted', 'started', 'completed', 'canceled'
// =============================================================================

model HealthCheck {
  id        Int      @id @default(autoincrement())
  name      String
  status    String
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("health_checks")
}

model Team {
  id          String   @id @default(uuid())
  name        String
  key         String   @unique
  description String?
  icon        String?
  color       String?
  isArchived  Boolean  @default(false) @map("is_archived")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  memberships Membership[]
  projects    Project[]
  statuses    Status[]

  @@map("teams")
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  name         String
  passwordHash String   @map("password_hash")
  avatarUrl    String?  @map("avatar_url")
  isActive     Boolean  @default(true) @map("is_active")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  memberships      Membership[]
  assignedFeatures Feature[]    @relation("AssignedFeatures")
  assignedTasks    Task[]       @relation("AssignedTasks")

  @@index([email])
  @@map("users")
}

model Membership {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  teamId    String   @map("team_id")
  role      String   @default("member")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  team Team @relation(fields: [teamId], references: [id], onDelete: Cascade)

  @@unique([userId, teamId])
  @@index([userId])
  @@index([teamId])
  @@map("memberships")
}

model Project {
  id          String   @id @default(uuid())
  teamId      String   @map("team_id")
  name        String
  description String?
  icon        String?
  color       String?
  sortOrder   Float    @default(0) @map("sort_order")
  isArchived  Boolean  @default(false) @map("is_archived")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  team     Team      @relation(fields: [teamId], references: [id], onDelete: Cascade)
  features Feature[]

  @@index([teamId])
  @@index([teamId, sortOrder])
  @@map("projects")
}

model Status {
  id        String   @id @default(uuid())
  teamId    String   @map("team_id")
  name      String
  category  String
  color     String?
  position  Int      @default(0)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  team     Team      @relation(fields: [teamId], references: [id], onDelete: Cascade)
  features Feature[]
  tasks    Task[]

  @@unique([teamId, name])
  @@index([teamId])
  @@index([teamId, position])
  @@map("statuses")
}

model Feature {
  id          String   @id @default(uuid())
  projectId   String   @map("project_id")
  identifier  String   @unique
  title       String
  description String?
  statusId    String?  @map("status_id")
  assigneeId  String?  @map("assignee_id")
  sortOrder   Float    @default(0) @map("sort_order")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  project  Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  status   Status? @relation(fields: [statusId], references: [id], onDelete: SetNull)
  assignee User?   @relation("AssignedFeatures", fields: [assigneeId], references: [id], onDelete: SetNull)
  tasks    Task[]

  @@index([projectId])
  @@index([statusId])
  @@index([assigneeId])
  @@index([projectId, sortOrder])
  @@index([projectId, statusId])
  @@index([assigneeId, statusId])
  @@map("features")
}

model Task {
  id          String   @id @default(uuid())
  featureId   String   @map("feature_id")
  identifier  String   @unique
  title       String
  description String?
  statusId    String?  @map("status_id")
  assigneeId  String?  @map("assignee_id")
  sortOrder   Float    @default(0) @map("sort_order")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  feature  Feature @relation(fields: [featureId], references: [id], onDelete: Cascade)
  status   Status? @relation(fields: [statusId], references: [id], onDelete: SetNull)
  assignee User?   @relation("AssignedTasks", fields: [assigneeId], references: [id], onDelete: SetNull)

  @@index([featureId])
  @@index([statusId])
  @@index([assigneeId])
  @@index([featureId, sortOrder])
  @@index([assigneeId, statusId])
  @@map("tasks")
}
```

---

## 6. New Environment Configuration

### 6.1 `.env` (Local Development)
```bash
DATABASE_URL="file:./data/spectree.db"
```

### 6.2 `.env.example`
```bash
# SQLite Database (file-based)
DATABASE_URL="file:./data/spectree.db"
```

---

## 7. New Docker Compose Configuration

```yaml
# SpecTree Local Development Environment
# Run: docker-compose up -d

services:
  # ==========================================================================
  # API Backend
  # ==========================================================================
  api:
    build:
      context: .
      dockerfile: packages/api/Dockerfile
    container_name: spectree-api
    restart: unless-stopped
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=development
      - PORT=3001
      - HOST=0.0.0.0
      - CORS_ORIGIN=http://localhost:5173
      - DATABASE_URL=file:/app/data/spectree.db
    volumes:
      - spectree-data:/app/data
    profiles:
      - full

  # ==========================================================================
  # Web Frontend
  # ==========================================================================
  web:
    build:
      context: .
      dockerfile: packages/web/Dockerfile
    container_name: spectree-web
    restart: unless-stopped
    ports:
      - "80:80"
    depends_on:
      - api
    profiles:
      - full

volumes:
  spectree-data:
```

---

## 8. New Backup Script

```bash
#!/bin/bash
# =============================================================================
# SpecTree Database Backup Script (SQLite)
# Usage: ./scripts/backup-db.sh
# =============================================================================

set -e

BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="spectree_${TIMESTAMP}.db"
DB_FILE="./packages/api/data/spectree.db"

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

# Alternative: simple file copy (works for idle databases)
# cp "$DB_FILE" "${BACKUP_DIR}/${BACKUP_FILE}"

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
```

---

## 9. New Restore Script

```bash
#!/bin/bash
# =============================================================================
# SpecTree Database Restore Script (SQLite)
# Usage: ./scripts/restore-db.sh <backup_file>
# =============================================================================

set -e

BACKUP_FILE="$1"
DB_FILE="./packages/api/data/spectree.db"
DB_DIR="./packages/api/data"

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
```

---

## 10. Important Notes

### 10.1 SQLite Limitations to Be Aware Of

1. **Concurrent Writes**: SQLite uses file-level locking. For this low-concurrency use case (few developers via MCP), this is not a concern.

2. **No `onDelete: NoAction`**: SQLite supports this, but Prisma recommends using `SetNull` or `Restrict` for clearer semantics. The new schema uses `SetNull` for optional relations.

3. **Foreign Keys**: SQLite has foreign keys disabled by default. Prisma handles this automatically by enabling them.

### 10.2 Data Migration

Since the current backup is corrupted and the user is starting fresh, no data migration is needed. Simply:
1. Update the schema
2. Run `prisma db push`
3. Run `npm run db:seed`

### 10.3 Testing Considerations

All existing tests should continue to work. The Prisma client API is identical regardless of the underlying database provider.

---

## 11. Rollback Plan

If issues are encountered:
1. Restore `schema.prisma` from git
2. Restore `.env` files
3. Restore `docker-compose.yml`
4. Run `docker-compose up -d` to start SQL Server
5. Run `prisma db push` to recreate schema
6. Run `npm run db:seed` to seed data

---

## 12. Post-Migration Verification

After migration, verify:
- [ ] `npm run dev` starts successfully
- [ ] `npm run db:studio` opens Prisma Studio with data
- [ ] API health endpoint returns success
- [ ] All CRUD operations work via API
- [ ] MCP tools function correctly
- [ ] Backup script creates valid backup
- [ ] Restore script successfully restores from backup
- [ ] Docker containerized deployment works
