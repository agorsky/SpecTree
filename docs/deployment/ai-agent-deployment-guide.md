# AI Agent Deployment Guide — SpecTree to Azure

> **Purpose**: This document enables an AI agent to execute a full production deployment of SpecTree to Azure using only Azure CLI commands run from the local machine. Follow every step in order. Do NOT skip steps. Do NOT proceed if a step fails.

---

## Overview

SpecTree has two containers deployed to Azure Container Apps:
- **API** (`ca-spectree-dev`) — Node.js/Fastify backend with Prisma ORM, connects to Azure SQL Server
- **Web** (`ca-spectree-web-dev`) — React SPA served by nginx, proxies `/api` requests to the API container

A deployment may also require a **database schema migration** if Prisma schema files have changed.

**Deployment order is critical:**
1. Build and push Docker images
2. Deploy schema changes to Azure SQL (if any)
3. Update API container
4. Update Web container
5. Verify deployment

---

## Prerequisites

Before starting, verify the following tools and access:

```bash
# 1. Azure CLI is installed and logged in
az version   # Requires 2.50.0+
az account show   # Must be logged in

# 2. Docker is running
docker version

# 3. You are in the SpecTree repository root
ls packages/api/Dockerfile.azure packages/web/Dockerfile packages/web/nginx.azure.conf
# All three files must exist

# 4. Working directory is clean or changes are intentional
git status
```

If `az account show` fails, run `az login` first.

---

## Environment Variables

Set these at the start of every deployment session. All values are fixed infrastructure names:

```bash
export ACR_NAME="acrspectreedev"
export RESOURCE_GROUP="rg-spectree-dev"
export SQL_SERVER="sql-spectree-dev"
export SQL_DATABASE="sqldb-spectree-dev"
export API_CONTAINER_APP="ca-spectree-dev"
export WEB_CONTAINER_APP="ca-spectree-web-dev"
export SQL_ADMIN_USER="sqladmin"
```

**You will also need the SQL admin password.** It is stored in `infra/.env.azure` as `SQL_ADMIN_PASSWORD`. Read it:

```bash
export SQL_ADMIN_PASSWORD=$(grep SQL_ADMIN_PASSWORD infra/.env.azure | cut -d= -f2)
```

Build the database connection string:

```bash
export SQLSERVER_DATABASE_URL="sqlserver://${SQL_SERVER}.database.windows.net:1433;database=${SQL_DATABASE};user=${SQL_ADMIN_USER};password=${SQL_ADMIN_PASSWORD};encrypt=true"
```

Generate a unique image tag for this deployment:

```bash
export IMAGE_TAG="deploy-$(date +%Y%m%d%H%M%S)"
echo "Image tag: $IMAGE_TAG"
```

---

## Step 1: Login to Azure Container Registry

```bash
az acr login --name $ACR_NAME
```

**Expected**: `Login Succeeded`

If this fails, verify you have `AcrPush` role on the ACR.

---

## Step 2: Build and Push API Image

The API image **must** use `Dockerfile.azure` (not the standard Dockerfile) because it generates the SQL Server Prisma client.

```bash
# Build from repository root
docker build \
  -t $ACR_NAME.azurecr.io/spectree-api:$IMAGE_TAG \
  -t $ACR_NAME.azurecr.io/spectree-api:latest \
  -f packages/api/Dockerfile.azure .

# Push both tags
docker push $ACR_NAME.azurecr.io/spectree-api:$IMAGE_TAG
docker push $ACR_NAME.azurecr.io/spectree-api:latest
```

**Expected**: Push completes with digest/size output. Build takes ~2-5 minutes.

---

## Step 3: Build and Push Web Image

The web image uses the standard `packages/web/Dockerfile`. No build args are required — the API URL is configured at runtime via Container App environment variables.

```bash
docker build \
  -t $ACR_NAME.azurecr.io/spectree-web:$IMAGE_TAG \
  -t $ACR_NAME.azurecr.io/spectree-web:latest \
  -f packages/web/Dockerfile .

docker push $ACR_NAME.azurecr.io/spectree-web:$IMAGE_TAG
docker push $ACR_NAME.azurecr.io/spectree-web:latest
```

**Expected**: Push completes successfully.

---

## Step 4: Deploy Schema Changes (Conditional)

**Check if schema files have changed** since the last deployment:

```bash
# Check if any Prisma schema files have uncommitted or recent changes
git diff --name-only HEAD~1 HEAD | grep 'packages/api/prisma/'
```

- If **no output** (no schema changes): **Skip to Step 5**.
- If **files are listed**: Continue with schema deployment below.

> **⚠️ CRITICAL DATABASE SAFETY RULES:**
> - 🔴 **NEVER** run `prisma migrate reset` — this deletes ALL data
> - 🔴 **NEVER** run `prisma migrate dev` — this may require destructive reset
> - 🔴 **NEVER** run `prisma db push --force-reset` — this deletes ALL data
> - ✅ The ONLY safe command is `npx prisma db push` (optionally with `--accept-data-loss` for new constraints)

### 4a: Add Temporary SQL Firewall Rule

```bash
export MY_IP=$(curl -s https://ifconfig.me)
export FIREWALL_RULE_NAME="TempDeploy-$(date +%Y%m%d-%H%M%S)"

az sql server firewall-rule create \
  --resource-group $RESOURCE_GROUP \
  --server $SQL_SERVER \
  --name "$FIREWALL_RULE_NAME" \
  --start-ip-address "$MY_IP" \
  --end-ip-address "$MY_IP"
```

**Expected**: JSON output showing the created firewall rule.

### 4b: Install Dependencies and Push Schema

```bash
# Install API dependencies (needed for Prisma CLI)
pnpm install --filter @spectree/api

# Push schema to Azure SQL
cd packages/api
npx prisma db push --schema=prisma/schema.sqlserver.prisma --accept-data-loss
```

**Expected output**:
```
Prisma schema loaded from prisma/schema.sqlserver.prisma
Datasource "db": SQL Server database
Your database is now in sync with your Prisma schema. Done in Xms
```

If you see `Column already has a DEFAULT bound to it` errors, you need to drop the offending DEFAULT constraints first:

```bash
# Connect to Azure SQL and find all DEFAULT constraints
# Then drop them and retry prisma db push
# See docs/deployment/azure-manual-deployment-runbook.md "Troubleshooting" section
```

### 4b.1: Apply Filtered Unique Indexes

**⚠️ MUST run after every `prisma db push`.** SQL Server requires filtered unique indexes for nullable columns. Prisma cannot express these natively, so they are maintained in a separate SQL script. This script is idempotent.

```bash
npx prisma db execute --schema=prisma/schema.sqlserver.prisma --file=prisma/sqlserver-post-push.sql
cd ../..
```

**Expected**: `Script executed successfully.`

### 4c: Remove Firewall Rule

**⚠️ ALWAYS remove the firewall rule, even if the schema push failed.**

```bash
az sql server firewall-rule delete \
  --resource-group $RESOURCE_GROUP \
  --server $SQL_SERVER \
  --name "$FIREWALL_RULE_NAME"
```

**Verify removal**:
```bash
az sql server firewall-rule list \
  --resource-group $RESOURCE_GROUP \
  --server $SQL_SERVER \
  --output table
```

Your rule should no longer appear. The only permanent rule should be `AllowAzureServices`.

---

## Step 5: Update API Container App

**⚠️ Important**: Use the unique `$IMAGE_TAG`, NOT `latest`. Azure Container Apps ignores pushes to the same tag and won't create a new revision.

```bash
az containerapp update \
  --name $API_CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --image $ACR_NAME.azurecr.io/spectree-api:$IMAGE_TAG
```

**Expected**: JSON output with the updated container app configuration and a new revision name.

---

## Step 6: Update Web Container App

```bash
az containerapp update \
  --name $WEB_CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --image $ACR_NAME.azurecr.io/spectree-web:$IMAGE_TAG
```

**Expected**: JSON output with updated configuration.

---

## Step 7: Verify Deployment

Wait 30 seconds for the new revisions to stabilize, then verify:

### 7a: Check API Health

```bash
API_FQDN=$(az containerapp show \
  --name $API_CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --query properties.configuration.ingress.fqdn -o tsv)

echo "API URL: https://$API_FQDN"
curl -sf "https://$API_FQDN/health"
```

**Expected**: `{"status":"ok"}` or similar healthy response.

### 7b: Check Web Health

```bash
WEB_FQDN=$(az containerapp show \
  --name $WEB_CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --query properties.configuration.ingress.fqdn -o tsv)

echo "Web URL: https://$WEB_FQDN"
curl -sf "https://$WEB_FQDN/health"
```

**Expected**: `healthy` response (served by nginx).

### 7c: Verify Active Revisions

```bash
echo "=== API Revisions ==="
az containerapp revision list \
  --name $API_CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --output table

echo "=== Web Revisions ==="
az containerapp revision list \
  --name $WEB_CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --output table
```

**Expected**: The newest revision for each container should show `Active: True`.

### 7d: Check for Errors in Logs

```bash
az containerapp logs show \
  --name $API_CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --tail 50 2>/dev/null | grep -i "error\|exception\|fail" || echo "No errors found"
```

**Expected**: `No errors found`

---

## Rollback Procedure

If the deployment fails or causes issues:

```bash
# List revisions to find the previous working one
az containerapp revision list \
  --name $API_CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --output table

# Activate the previous revision (replace <old-revision-name>)
az containerapp revision activate \
  --name $API_CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --revision <old-revision-name>

# Route traffic back to old revision
az containerapp ingress traffic set \
  --name $API_CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --revision-weight <old-revision-name>=100
```

Repeat for the web container if needed.

> **Note**: Schema changes cannot be rolled back automatically. If a schema change caused the issue, you'll need to manually revert the schema or fix forward.

---

## Deployment Complete Checklist

- [ ] Docker images built and pushed (API + Web)
- [ ] Schema deployed to Azure SQL (if changed)
- [ ] SQL firewall rule removed
- [ ] API container updated and healthy
- [ ] Web container updated and healthy
- [ ] No errors in API logs
- [ ] Both containers show new active revisions

---

## Quick Reference

| Resource | Value |
|----------|-------|
| Resource Group | `rg-spectree-dev` |
| ACR | `acrspectreedev` |
| SQL Server | `sql-spectree-dev` |
| SQL Database | `sqldb-spectree-dev` |
| SQL Admin User | `sqladmin` |
| API Container App | `ca-spectree-dev` |
| Web Container App | `ca-spectree-web-dev` |
| API Dockerfile | `packages/api/Dockerfile.azure` |
| Web Dockerfile | `packages/web/Dockerfile` |
| SQL Server Schema | `packages/api/prisma/schema.sqlserver.prisma` |
| Credentials File | `infra/.env.azure` |
