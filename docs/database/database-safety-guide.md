# Database Safety Guide

This document explains how to work safely with the Dispatcher database to prevent accidental data loss.

## Overview

Dispatcher uses SQLite for its database, stored at `packages/api/prisma/data/dispatcher.db`. This file contains all your projects, features, tasks, and user data.

**⚠️ WARNING**: Certain Prisma commands can permanently delete all data. Always backup before running database commands.

---

## Safe vs Dangerous Commands

### ✅ Safe Commands

| Command | What it does |
|---------|--------------|
| `npm run db:studio` | Opens Prisma Studio GUI (read/write but manual) |
| `npm run db:generate` | Regenerates Prisma client from schema |
| `npm run db:seed` | Inserts seed data (additive, doesn't delete) |
| `npm run db:backup` | Creates a timestamped backup |
| `npx prisma migrate deploy` | Applies pending migrations (doesn't delete) |

### ⚠️ Dangerous Commands (May Delete All Data)

| Command | Risk | What it does |
|---------|------|--------------|
| `npx prisma migrate reset` | 🔴 HIGH | **DELETES ALL DATA** and re-runs migrations |
| `npx prisma migrate dev` | 🟠 MEDIUM | May require reset if schema drift detected |
| `npx prisma db push --force-reset` | 🔴 HIGH | **DELETES ALL DATA** and recreates schema |

### 🚫 Blocked Command

The `npm run db:migrate` command is intentionally blocked and will show a warning. Use `npm run db:migrate:safe` instead, which creates a backup first.

---

## Backup and Restore

### Creating a Backup

```bash
cd packages/api
npm run db:backup
```

This creates a timestamped backup in the `backups/` directory.

### Restoring from Backup

```bash
# List available backups
ls -la backups/

# Restore (replace <timestamp> with actual filename)
cp backups/dispatcher_<timestamp>.db packages/api/prisma/data/dispatcher.db
```

---

## Test vs Production Databases

The project is configured to use **separate databases**:

| Environment | Database File | Used By |
|-------------|--------------|---------|
| Development | `dispatcher.db` | API server, MCP |
| Testing | `dispatcher-test.db` | Vitest test suite |

This separation prevents tests from accidentally deleting your real data.

### Test Database Configuration

Tests automatically use `dispatcher-test.db` via `vitest.config.ts`:

```typescript
env: {
  DATABASE_URL: "file:./data/dispatcher-test.db",
}
```

---

## What Causes "Schema Drift"?

Schema drift occurs when:
1. You use `prisma db push` to create/modify the schema
2. Later you try to use `prisma migrate dev`
3. Prisma sees the database doesn't match any migration files
4. It requires a reset to sync

### Preventing Schema Drift

**Option 1: Always use migrations** (recommended for production)
```bash
npm run db:migrate:safe  # Creates backup + runs migration
```

**Option 2: Use db push** (fine for early development)
```bash
npx prisma db push  # Directly syncs schema, no migrations
```

**Don't mix these approaches** on the same database.

---

## Recovery Procedures

### If You Accidentally Reset the Database

1. Check for backups:
   ```bash
   ls -la backups/
   ls -la packages/api/prisma/data/*.backup
   ```

2. Restore the most recent backup:
   ```bash
   cp backups/dispatcher_YYYYMMDD_HHMMSS.db packages/api/prisma/data/dispatcher.db
   ```

3. If the backup is missing new schema (like `api_tokens` table):
   ```bash
   # Restore backup first
   cp backups/dispatcher_YYYYMMDD_HHMMSS.db packages/api/prisma/data/dispatcher.db
   
   # Then apply new schema without data loss
   npx prisma db push
   ```

### If No Backup Exists

Unfortunately, without a backup, the data cannot be recovered. This is why regular backups are critical.

---

## Best Practices

1. **Backup before any database command** - Run `npm run db:backup` first
2. **Use the test database for testing** - Tests should never touch `dispatcher.db`
3. **Don't run `prisma migrate reset`** - It deletes everything
4. **Check DATABASE_URL** - Make sure you're targeting the right database
5. **Regular automated backups** - Consider a cron job for important data

---

## Environment Files

| File | Purpose |
|------|---------|
| `.env` | Development database (dispatcher.db) |
| `.env.test` | Test database (dispatcher-test.db) |

The test configuration is automatically loaded by Vitest.
