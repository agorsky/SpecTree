# Database Multi-Provider Setup

SpecTree uses Prisma ORM with support for multiple database providers:

- **SQLite** - Local development (default)
- **SQL Server** - Azure production deployment

## Schema Files

| File | Provider | Use Case |
|------|----------|----------|
| `prisma/schema.prisma` | SQLite | Local development |
| `prisma/schema.sqlserver.prisma` | SQL Server | Azure SQL production |

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | SQLite connection (local) | `file:./data/spectree.db` |
| `SQLSERVER_DATABASE_URL` | Azure SQL connection | `sqlserver://server.database.windows.net:1433;database=db;user=user;password=pwd;encrypt=true` |

## NPM Scripts

### Local Development (SQLite)

```bash
# Generate Prisma client
npm run db:generate

# Push schema changes (without migrations)
npm run db:push

# Run migrations
npm run db:migrate:deploy

# Open Prisma Studio
npm run db:studio
```

### Azure SQL Production

```bash
# Set the connection string
export SQLSERVER_DATABASE_URL="sqlserver://sql-spectree-dev.database.windows.net:1433;database=sqldb-spectree-dev;user=sqladmin;password=<PASSWORD>;encrypt=true"

# Generate Prisma client for SQL Server
npm run db:generate:sqlserver

# Push schema to Azure SQL
npm run db:push:sqlserver

# Deploy migrations to Azure SQL
npm run db:migrate:deploy:sqlserver

# Open Prisma Studio for Azure SQL
npm run db:studio:sqlserver
```

## SQL Server Schema Differences

The SQL Server schema (`schema.sqlserver.prisma`) has some differences from the SQLite schema due to SQL Server's stricter referential integrity rules:

### Cyclic Referential Actions

SQL Server doesn't allow multiple cascade paths to the same table. The following relations use `onDelete: NoAction` instead of cascade/setNull:

- `Status.team` and `Status.personalScope` - NoAction (must delete statuses manually before team/scope)
- `Feature.status` and `Feature.assignee` - NoAction (must nullify in application code)
- `Task.status` and `Task.assignee` - NoAction (must nullify in application code)

This means the application must handle cleanup in the correct order when deleting:
1. Delete/update features and tasks first
2. Delete statuses
3. Delete teams/personal scopes

## Initial Azure SQL Setup

See [Azure Deployment Guide](./azure-deployment-guide.md) for full deployment instructions.

### Quick Migration Steps

1. **Add temporary firewall rule** (for migration only):
   ```bash
   MY_IP=$(curl -s ifconfig.me)
   az sql server firewall-rule create \
     --resource-group rg-spectree-dev \
     --server sql-spectree-dev \
     --name "TempMigrationAccess" \
     --start-ip-address $MY_IP \
     --end-ip-address $MY_IP
   ```

2. **Set connection string**:
   ```bash
   export SQLSERVER_DATABASE_URL="sqlserver://sql-spectree-dev.database.windows.net:1433;database=sqldb-spectree-dev;user=sqladmin;password=<PASSWORD>;encrypt=true"
   ```

3. **Push schema to Azure SQL**:
   ```bash
   cd packages/api
   npm run db:push:sqlserver
   ```

4. **Remove firewall rule**:
   ```bash
   az sql server firewall-rule delete \
     --resource-group rg-spectree-dev \
     --server sql-spectree-dev \
     --name "TempMigrationAccess"
   ```

## Production Deployment

For production, set `DATABASE_URL` environment variable in your Container App configuration to point to Azure SQL:

```bash
# In Container App, set DATABASE_URL (not SQLSERVER_DATABASE_URL)
az containerapp update \
  --name api-spectree-dev \
  --resource-group rg-spectree-dev \
  --set-env-vars "DATABASE_URL=sqlserver://..."
```

The application uses `DATABASE_URL` at runtime. The separate `SQLSERVER_DATABASE_URL` is only for local Prisma CLI operations.

## Keeping Schemas in Sync

When modifying the database schema:

1. Update `prisma/schema.prisma` (SQLite) first
2. Copy changes to `prisma/schema.sqlserver.prisma`
3. Adjust referential actions if needed (NoAction for multi-path cascades)
4. Validate both schemas:
   ```bash
   npx prisma validate
   SQLSERVER_DATABASE_URL="sqlserver://localhost:1433;database=test;user=test;password=test;encrypt=false" npx prisma validate --schema=prisma/schema.sqlserver.prisma
   ```
