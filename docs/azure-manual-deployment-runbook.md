# Azure Manual Deployment Runbook

> **Operational guide for manual deployment of SpecTree to Azure**
>
> This runbook provides step-by-step procedures for deploying SpecTree to Azure Container Apps without CI/CD automation. Use this when CI/CD pipelines are unavailable or for emergency deployments.

---

## Table of Contents

1. [When to Use This Runbook](#when-to-use-this-runbook)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Manual Deployment Procedure](#manual-deployment-procedure)
4. [SQL Firewall Management](#sql-firewall-management)
5. [Post-Deployment Verification](#post-deployment-verification)
6. [Troubleshooting](#troubleshooting)
7. [Rollback Procedures](#rollback-procedures)

---

## When to Use This Runbook

Use manual deployment when:

- **CI/CD pipelines are not configured** - OIDC authentication or GitHub Actions workflows are not set up
- **Emergency deployments** - Critical fixes need to be deployed immediately outside the normal pipeline
- **Testing deployment procedures** - Validating deployment steps before automating them
- **One-off deployments** - Dev/test environments that don't justify CI/CD setup

**⚠️ Production Warning**: Manual deployments bypass automated testing and approval gates. Use with caution in production environments.

---

## Pre-Deployment Checklist

Complete ALL items before proceeding with deployment. Missing prerequisites will cause deployment failures.

### 1. Azure CLI Access

- [ ] Azure CLI installed (version 2.50.0 or later)
  ```bash
  az version
  ```

- [ ] Logged in to Azure
  ```bash
  az login
  az account show
  ```

- [ ] Correct subscription selected
  ```bash
  # List available subscriptions
  az account list -o table
  
  # Set correct subscription if needed
  az account set --subscription "<subscription-id-or-name>"
  ```

### 2. Azure Container Registry (ACR) Access

- [ ] ACR name identified
  ```bash
  export ACR_NAME="<your-acr-name>"  # e.g., "acrspectreedev"
  export RESOURCE_GROUP="rg-spectree-dev"
  ```

- [ ] ACR login successful
  ```bash
  az acr login --name $ACR_NAME
  # Expected: "Login Succeeded"
  ```

- [ ] ACR permissions verified (AcrPush role required)
  ```bash
  az acr show --name $ACR_NAME --query id -o tsv
  ```

### 3. Azure SQL Database Access

- [ ] SQL Server name identified
  ```bash
  export SQL_SERVER="sql-spectree-dev"
  export SQL_DATABASE="sqldb-spectree-dev"
  ```

- [ ] SQL admin credentials available
  ```bash
  # Stored in Azure Key Vault or secure password manager
  export SQL_ADMIN_USER="sqladmin"
  export SQL_ADMIN_PASSWORD="<secure-password>"
  ```

- [ ] Database connection string prepared
  ```bash
  export SQLSERVER_DATABASE_URL="sqlserver://${SQL_SERVER}.database.windows.net:1433;database=${SQL_DATABASE};user=${SQL_ADMIN_USER};password=${SQL_ADMIN_PASSWORD};encrypt=true"
  ```

### 4. Container App Configuration

- [ ] Container App name identified
  ```bash
  export CONTAINER_APP="ca-spectree-dev"
  ```

- [ ] Current revision identified (for potential rollback)
  ```bash
  az containerapp revision list \
    --name $CONTAINER_APP \
    --resource-group $RESOURCE_GROUP \
    -o table
  
  # Save current active revision name
  export CURRENT_REVISION=$(az containerapp revision list \
    --name $CONTAINER_APP \
    --resource-group $RESOURCE_GROUP \
    --query "[?properties.active].name | [0]" -o tsv)
  
  echo "Current active revision: $CURRENT_REVISION"
  ```

### 5. Docker Environment

- [ ] Docker installed and running
  ```bash
  docker version
  docker ps
  ```

- [ ] Sufficient disk space available (minimum 10GB free)
  ```bash
  df -h .
  ```

### 6. Source Code

- [ ] Git repository up to date
  ```bash
  cd /path/to/SpecTree
  git status
  git pull origin main  # or appropriate branch
  ```

- [ ] Working directory is clean (or changes are intentional)
  ```bash
  git --no-pager status
  ```

- [ ] Correct branch checked out
  ```bash
  git branch --show-current
  ```

### 7. Environment Variables

- [ ] All required environment variables documented
  - `DATABASE_URL` - Set in Container App (points to Azure SQL)
  - `SESSION_SECRET` - Stored in Azure Key Vault
  - `ALLOWED_ORIGINS` - CORS configuration
  - Any other application-specific variables

### 8. Network Access

- [ ] Outbound internet access available (for Docker pulls and Azure API calls)
  ```bash
  curl -I https://azure.microsoft.com
  ```

- [ ] Local IP address identified (needed for SQL firewall rule)
  ```bash
  export MY_IP=$(curl -s ifconfig.me)
  echo "My IP: $MY_IP"
  ```

### Pre-Deployment Checklist Summary

Print all variables to verify configuration:

```bash
echo "=== Deployment Configuration ==="
echo "ACR_NAME: $ACR_NAME"
echo "RESOURCE_GROUP: $RESOURCE_GROUP"
echo "SQL_SERVER: $SQL_SERVER"
echo "SQL_DATABASE: $SQL_DATABASE"
echo "CONTAINER_APP: $CONTAINER_APP"
echo "CURRENT_REVISION: $CURRENT_REVISION"
echo "MY_IP: $MY_IP"
echo "Current Directory: $(pwd)"
echo "Git Branch: $(git branch --show-current)"
echo "================================"
```

**✅ Proceed to Manual Deployment Procedure only if ALL checklist items are complete.**

---

## Manual Deployment Procedure

Follow these steps in order. Do NOT skip steps or proceed if a step fails.

### Step 1: Build Docker Image with Dockerfile.azure

The `Dockerfile.azure` is specifically configured for Azure deployment with SQL Server support.

```bash
# Navigate to repository root
cd /path/to/SpecTree

# Verify you're in the correct directory
ls -la packages/api/Dockerfile.azure

# Build API image using Dockerfile.azure
# This uses the SQL Server Prisma schema (schema.sqlserver.prisma)
docker build -t spectree-api:latest -f packages/api/Dockerfile.azure .

# Expected output: Successfully built and tagged spectree-api:latest
# Build time: ~2-5 minutes depending on your machine
```

**What Dockerfile.azure does:**
- Uses Node.js 22 Alpine base image
- Installs pnpm via corepack
- Builds shared package first (@spectree/shared)
- Generates Prisma client for SQL Server (`schema.sqlserver.prisma`)
- Compiles TypeScript to production build
- Creates optimized production image with only runtime dependencies
- Exposes port 3001

**⚠️ Important**: Always use `Dockerfile.azure` for Azure deployments, NOT the standard `Dockerfile`. The Azure version generates the SQL Server-compatible Prisma client.

### Step 2: Tag Docker Image for ACR

```bash
# Tag with version number (recommended for production)
docker tag spectree-api:latest $ACR_NAME.azurecr.io/spectree-api:v$(date +%Y%m%d-%H%M%S)

# Tag as latest (for easy reference)
docker tag spectree-api:latest $ACR_NAME.azurecr.io/spectree-api:latest

# Verify tags
docker images | grep spectree-api
```

**Tagging Strategy:**
- Use timestamped versions for audit trail: `v20260209-143000`
- Use semantic versions for releases: `v1.2.3`
- Always maintain `latest` tag for current production version
- Never reuse version tags (immutable versions)

### Step 3: Push Docker Image to ACR

```bash
# Push versioned image
docker push $ACR_NAME.azurecr.io/spectree-api:v$(date +%Y%m%d-%H%M%S)

# Push latest tag
docker push $ACR_NAME.azurecr.io/spectree-api:latest

# Expected output:
# The push refers to repository [<acr-name>.azurecr.io/spectree-api]
# v<timestamp>: digest: sha256:... size: ...
# latest: digest: sha256:... size: ...

# Verify image is in ACR
az acr repository show-tags \
  --name $ACR_NAME \
  --repository spectree-api \
  --orderby time_desc \
  --output table

# Expected: List of tags including your new version and 'latest'
```

**Push Time**: 1-3 minutes depending on network speed and image size.

**If push fails:**
- Verify ACR login: `az acr login --name $ACR_NAME`
- Check ACR permissions: You need `AcrPush` role
- Check network connectivity to Azure

### Step 4: Deploy Schema to Azure SQL Database

Before updating the container app, ensure the database schema is up to date.

**⚠️ Critical**: This step requires adding a temporary firewall rule to Azure SQL Server. See [SQL Firewall Management](#sql-firewall-management) section for details.

```bash
# Add temporary firewall rule (see SQL Firewall Management section)
az sql server firewall-rule create \
  --resource-group $RESOURCE_GROUP \
  --server $SQL_SERVER \
  --name "TempDeployment-$(whoami)-$(date +%Y%m%d)" \
  --start-ip-address $MY_IP \
  --end-ip-address $MY_IP

# Verify rule was created
az sql server firewall-rule show \
  --resource-group $RESOURCE_GROUP \
  --server $SQL_SERVER \
  --name "TempDeployment-$(whoami)-$(date +%Y%m%d)"

# Navigate to API package
cd packages/api

# Set SQL Server connection string
export SQLSERVER_DATABASE_URL="sqlserver://${SQL_SERVER}.database.windows.net:1433;database=${SQL_DATABASE};user=${SQL_ADMIN_USER};password=${SQL_ADMIN_PASSWORD};encrypt=true"

# Push schema to Azure SQL
# This updates the database schema without creating migration files
pnpm run db:push:sqlserver

# Expected output:
# Environment variables loaded from .env
# Prisma schema loaded from prisma/schema.sqlserver.prisma
# Datasource "db": SQL Server database "sqldb-spectree-dev" at "sql-spectree-dev.database.windows.net:1433"
# 
# Your database is now in sync with your Prisma schema. Done in Xms

# Alternative: Deploy migrations (if using migration files)
# pnpm run db:migrate:deploy:sqlserver

# Return to repository root
cd ../..

# IMPORTANT: Remove temporary firewall rule immediately
az sql server firewall-rule delete \
  --resource-group $RESOURCE_GROUP \
  --server $SQL_SERVER \
  --name "TempDeployment-$(whoami)-$(date +%Y%m%d)"

# Verify rule was removed
az sql server firewall-rule list \
  --resource-group $RESOURCE_GROUP \
  --server $SQL_SERVER \
  --output table
```

**Schema Deployment Commands:**

| Command | When to Use |
|---------|-------------|
| `db:push:sqlserver` | Development/testing - Quick schema sync without migrations |
| `db:migrate:deploy:sqlserver` | Production - Apply migration files in order |
| `db:generate:sqlserver` | Generate Prisma client only (already done in Dockerfile.azure) |

**⚠️ Security Note**: Always remove the temporary firewall rule immediately after schema deployment. Leaving it open is a security risk.

### Step 5: Update Container App with New Image

```bash
# Update Container App to use the new image
az containerapp update \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --image $ACR_NAME.azurecr.io/spectree-api:latest

# Expected output:
# Container app '<container-app-name>' updated successfully.
# New revision '<revision-name>' created.

# The update command will:
# 1. Create a new revision with the updated image
# 2. Perform a rolling update (gradual traffic shift)
# 3. Deactivate the old revision once new revision is healthy
```

**Update Process:**
- **Duration**: 2-5 minutes
- **Zero-downtime**: Traffic gradually shifts from old to new revision
- **Health checks**: New revision must pass health checks before receiving traffic
- **Automatic rollback**: If new revision fails health checks, traffic stays on old revision

### Step 6: Monitor Deployment

```bash
# Check deployment status
az containerapp revision list \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --output table

# Expected output shows new revision as 'Active' and old revision as 'Inactive'
# Revision Name                                    Active    Created
# -----------------------------------------------  --------  --------------------------
# ca-spectree-dev--<new-revision>                  True      2026-02-09T18:20:00.000000+00:00
# ca-spectree-dev--<old-revision>                  False     2026-02-09T17:00:00.000000+00:00

# View live logs to verify application startup
az containerapp logs show \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --follow

# Press Ctrl+C to stop following logs

# Expected log entries:
# - "Server listening at http://0.0.0.0:3001"
# - Database connection successful
# - No error messages
```

**Monitoring Tools:**
```bash
# Get application URL
az containerapp show \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --query properties.configuration.ingress.fqdn \
  --output tsv

# Test health endpoint
curl https://$(az containerapp show \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --query properties.configuration.ingress.fqdn \
  --output tsv)/health

# Expected: {"status":"ok"} or similar health response
```

### Step 7: Verify Deployment Success

See [Post-Deployment Verification](#post-deployment-verification) section for detailed verification steps.

Quick verification:

```bash
# 1. Check application is responding
APP_URL=$(az containerapp show \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --query properties.configuration.ingress.fqdn \
  --output tsv)

curl -I https://$APP_URL/health

# Expected: HTTP/2 200 OK

# 2. Verify database connectivity
# Check logs for successful database connection messages
az containerapp logs show \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --tail 50 | grep -i "database\|prisma"

# 3. Check for errors
az containerapp logs show \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --tail 100 | grep -i "error\|exception\|fail"

# Expected: No critical errors
```

### Deployment Complete

✅ **Success Criteria:**
- [ ] New Docker image built with Dockerfile.azure
- [ ] Image pushed to ACR successfully
- [ ] Database schema deployed to Azure SQL
- [ ] Temporary SQL firewall rule removed
- [ ] Container App updated with new image
- [ ] New revision is active and healthy
- [ ] Application is responding to requests
- [ ] No errors in logs
- [ ] Previous revision saved (for potential rollback)

**Next Steps:**
- Monitor application for 10-15 minutes
- Check error logs periodically
- Verify critical features are working
- Keep previous revision available for 24 hours (rollback window)

---

## SQL Firewall Management

Azure SQL Server requires explicit firewall rules to allow connections. For deployment tasks, you need temporary access to push schema changes from your local machine.

### Understanding SQL Firewall Rules

**Why Firewall Rules Are Needed:**
- Azure SQL Server blocks all connections by default
- Firewall rules allow specific IP addresses to connect
- Schema deployment (Prisma push/migrate) requires direct database connection
- Container Apps use VNet integration and don't need firewall rules

**Security Best Practices:**
- ✅ Create rules only when needed (just-in-time access)
- ✅ Use specific IP addresses, never use `0.0.0.0` to `255.255.255.255`
- ✅ Remove rules immediately after use
- ✅ Use descriptive names with date/user information
- ❌ Never leave development firewall rules open permanently
- ❌ Never commit firewall rules to infrastructure code for dev machines

### Get Your Current IP Address

```bash
# Get your public IP address
MY_IP=$(curl -s ifconfig.me)
echo "My IP: $MY_IP"

# Alternative methods if ifconfig.me is unavailable
MY_IP=$(curl -s https://api.ipify.org)
MY_IP=$(dig +short myip.opendns.com @resolver1.opendns.com)

# Verify IP format (should be xxx.xxx.xxx.xxx)
echo $MY_IP | grep -E '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$'
```

### Add Temporary Firewall Rule

Use descriptive names that include who created it and when:

```bash
# Create temporary firewall rule
RULE_NAME="TempDeployment-$(whoami)-$(date +%Y%m%d-%H%M)"

az sql server firewall-rule create \
  --resource-group $RESOURCE_GROUP \
  --server $SQL_SERVER \
  --name $RULE_NAME \
  --start-ip-address $MY_IP \
  --end-ip-address $MY_IP

# Expected output:
# {
#   "endIpAddress": "xxx.xxx.xxx.xxx",
#   "id": "/subscriptions/.../firewallRules/TempDeployment-...",
#   "name": "TempDeployment-user-20260209-1420",
#   "resourceGroup": "rg-spectree-dev",
#   "startIpAddress": "xxx.xxx.xxx.xxx",
#   "type": "Microsoft.Sql/servers/firewallRules"
# }
```

**Rule Naming Convention:**
- `TempDeployment-<username>-<date>-<time>` - Deployment tasks
- `TempMigration-<username>-<date>` - Schema migrations
- `Debug-<username>-<date>` - Debugging sessions

### Verify Firewall Rule

```bash
# Show specific rule
az sql server firewall-rule show \
  --resource-group $RESOURCE_GROUP \
  --server $SQL_SERVER \
  --name $RULE_NAME

# List all firewall rules
az sql server firewall-rule list \
  --resource-group $RESOURCE_GROUP \
  --server $SQL_SERVER \
  --output table

# Expected output shows your rule in the list:
# Name                                StartIpAddress    EndIpAddress
# ----------------------------------  ----------------  ----------------
# AllowAzureServices                  0.0.0.0          0.0.0.0
# TempDeployment-user-20260209-1420   xxx.xxx.xxx.xxx  xxx.xxx.xxx.xxx
```

### Test Database Connection

```bash
# Test connection with Prisma
cd packages/api

export SQLSERVER_DATABASE_URL="sqlserver://${SQL_SERVER}.database.windows.net:1433;database=${SQL_DATABASE};user=${SQL_ADMIN_USER};password=${SQL_ADMIN_PASSWORD};encrypt=true"

# Simple connection test
pnpm exec prisma db execute \
  --schema=prisma/schema.sqlserver.prisma \
  --stdin <<< "SELECT 1 AS test"

# Expected output: Query executed successfully

# Alternative: Use Azure CLI to test
az sql db show-connection-string \
  --server $SQL_SERVER \
  --name $SQL_DATABASE \
  --client ado.net

cd ../..
```

### Remove Firewall Rule

**⚠️ CRITICAL**: Always remove temporary firewall rules after completing your task.

**🔴 SECURITY WARNING**: Leaving temporary firewall rules open indefinitely exposes your Azure SQL Server to potential unauthorized access. Stale rules create security vulnerabilities that persist long after the original deployment task is completed. Always verify rule cleanup as the final step of any deployment workflow.

```bash
# Remove specific rule
az sql server firewall-rule delete \
  --resource-group $RESOURCE_GROUP \
  --server $SQL_SERVER \
  --name $RULE_NAME

# Expected output: (no output on success)

# Verify deletion
az sql server firewall-rule list \
  --resource-group $RESOURCE_GROUP \
  --server $SQL_SERVER \
  --output table

# Expected: Rule should no longer appear in the list
```

### Remove Multiple Temporary Rules

If you have multiple temporary rules to clean up:

```bash
# List all temp rules
az sql server firewall-rule list \
  --resource-group $RESOURCE_GROUP \
  --server $SQL_SERVER \
  --query "[?contains(name, 'Temp')].name" \
  --output tsv

# Delete all temp rules (use with caution!)
az sql server firewall-rule list \
  --resource-group $RESOURCE_GROUP \
  --server $SQL_SERVER \
  --query "[?contains(name, 'Temp')].name" \
  --output tsv | while read rule; do
    echo "Deleting: $rule"
    az sql server firewall-rule delete \
      --resource-group $RESOURCE_GROUP \
      --server $SQL_SERVER \
      --name "$rule"
done

# Verify cleanup
az sql server firewall-rule list \
  --resource-group $RESOURCE_GROUP \
  --server $SQL_SERVER \
  --output table
```

### Firewall Rule Troubleshooting

**Problem**: Cannot connect to database even with firewall rule

```bash
# 1. Verify your IP hasn't changed
CURRENT_IP=$(curl -s ifconfig.me)
echo "Current IP: $CURRENT_IP"
echo "Rule IP: <check rule with az sql server firewall-rule show>"

# If IP changed, delete old rule and create new one
az sql server firewall-rule delete --resource-group $RESOURCE_GROUP --server $SQL_SERVER --name $RULE_NAME
az sql server firewall-rule create --resource-group $RESOURCE_GROUP --server $SQL_SERVER --name $RULE_NAME --start-ip-address $CURRENT_IP --end-ip-address $CURRENT_IP

# 2. Check SQL Server allows Azure services
az sql server show \
  --resource-group $RESOURCE_GROUP \
  --name $SQL_SERVER \
  --query publicNetworkAccess \
  --output tsv

# Expected: "Enabled"

# 3. Verify connection string format
echo $SQLSERVER_DATABASE_URL
# Should be: sqlserver://SERVER.database.windows.net:1433;database=DB;user=USER;password=PASS;encrypt=true

# 4. Test with Azure CLI
az sql db show \
  --resource-group $RESOURCE_GROUP \
  --server $SQL_SERVER \
  --name $SQL_DATABASE
```

**Problem**: Firewall rule creation fails

```bash
# Check permissions
az role assignment list \
  --scope /subscriptions/<subscription-id>/resourceGroups/$RESOURCE_GROUP \
  --query "[?principalId=='<your-user-id>'].{Role:roleDefinitionName}" \
  --output table

# Required roles: Contributor, SQL Server Contributor, or Owner

# Check SQL Server exists
az sql server show \
  --resource-group $RESOURCE_GROUP \
  --name $SQL_SERVER
```

### Firewall Management Checklist

Before deployment:
- [ ] Get current IP address
- [ ] Create temporary firewall rule with descriptive name
- [ ] Verify rule was created
- [ ] Test database connection

After deployment:
- [ ] Remove temporary firewall rule
- [ ] Verify rule was deleted
- [ ] List all firewall rules to confirm no stale temp rules remain
- [ ] Document any issues encountered

**Security Reminder**: Temporary firewall rules should exist for minutes, not hours or days. Set a timer or calendar reminder to remove the rule if your deployment task will take more than 15 minutes.

**⚠️ Regular Maintenance**: Periodically audit your Azure SQL Server firewall rules to identify and remove any stale temporary rules that were not properly cleaned up. Stale rules with names like "TempAccess", "TempDeployment", or "TempMigration" should be investigated and removed if they're no longer needed.

---

## Post-Deployment Verification

After deployment, systematically verify each component to ensure the system is functioning correctly.

### 1. Container App Health Check

```bash
# Get Container App URL
APP_URL=$(az containerapp show \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --query properties.configuration.ingress.fqdn \
  --output tsv)

echo "Application URL: https://$APP_URL"

# Test health endpoint
curl -i https://$APP_URL/health

# Expected response:
# HTTP/2 200 
# content-type: application/json
# {"status":"ok"} or {"status":"healthy"}

# If health endpoint returns 200, application is running
```

### 2. Verify New Revision is Active

```bash
# List all revisions
az containerapp revision list \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --output table

# Expected output:
# Revision Name                              Active    Created                      Traffic Weight
# -----------------------------------------  --------  ---------------------------  --------------
# ca-spectree-dev--<new-revision>            True      2026-02-09T18:21:00+00:00    100%
# ca-spectree-dev--<old-revision>            False     2026-02-09T17:00:00+00:00    0%

# Verify revision details
az containerapp revision show \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --revision <new-revision-name> \
  --query "{Name:name, Active:properties.active, Created:properties.createdTime, Replicas:properties.replicas, Image:properties.template.containers[0].image}"
```

### 3. Check Application Logs

```bash
# View recent logs (last 50 lines)
az containerapp logs show \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --tail 50

# Look for:
# ✅ "Server listening at http://0.0.0.0:3001"
# ✅ Successful database connection messages
# ✅ "Prisma Client" initialization
# ❌ No ERROR or EXCEPTION entries
# ❌ No "Connection refused" or "ECONNREFUSED"

# Search for errors
az containerapp logs show \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --tail 200 | grep -i "error\|exception\|fail\|fatal"

# If no output, good! No errors found.

# Follow logs in real-time (Ctrl+C to exit)
az containerapp logs show \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --follow
```

### 4. Test API Endpoints

```bash
# Test root endpoint
curl https://$APP_URL/

# Test API routes (adjust based on your API)
curl https://$APP_URL/api/health
curl https://$APP_URL/api/version

# If your API requires authentication, test with credentials
# curl -H "Authorization: Bearer <token>" https://$APP_URL/api/protected-endpoint

# Test CORS (if applicable)
curl -H "Origin: https://yourdomain.com" \
  -H "Access-Control-Request-Method: GET" \
  -X OPTIONS \
  -i https://$APP_URL/api/health

# Expected: Access-Control-Allow-Origin header present
```

### 5. Verify Database Connectivity

```bash
# Check logs for Prisma/database messages
az containerapp logs show \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --tail 100 | grep -i "prisma\|database\|sql"

# Expected messages:
# - Prisma Client initialized
# - Database connection pool created
# - No connection errors

# Verify environment variables are set
az containerapp show \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --query "properties.template.containers[0].env" \
  --output table

# Check DATABASE_URL is set (value will be hidden)
az containerapp show \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --query "properties.template.containers[0].env[?name=='DATABASE_URL'].name" \
  --output tsv

# Expected: DATABASE_URL
```

### 6. Performance Check

```bash
# Check replica count (should match your scale settings)
az containerapp show \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --query "properties.template.scale.{Min:minReplicas, Max:maxReplicas}" \
  --output table

# Check current running replicas
az containerapp revision show \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --revision <new-revision-name> \
  --query "properties.replicas" \
  --output tsv

# Test response time
time curl -s https://$APP_URL/health > /dev/null

# Expected: < 2 seconds for health endpoint
```

### 7. Verify Image Version

```bash
# Check which image is deployed
az containerapp show \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --query "properties.template.containers[0].image" \
  --output tsv

# Expected: <acr-name>.azurecr.io/spectree-api:latest (or your version tag)

# Verify image exists in ACR
IMAGE_TAG=$(az containerapp show \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --query "properties.template.containers[0].image" \
  --output tsv | cut -d: -f2)

az acr repository show-tags \
  --name $ACR_NAME \
  --repository spectree-api \
  --output table | grep $IMAGE_TAG

# Expected: Tag should be listed
```

### Verification Checklist

Complete ALL verification steps:

- [ ] Health endpoint returns 200 OK
- [ ] New revision is active with 100% traffic
- [ ] Application logs show successful startup
- [ ] No errors in recent logs
- [ ] API endpoints respond correctly
- [ ] Database connectivity confirmed in logs
- [ ] Environment variables configured correctly
- [ ] Expected number of replicas running
- [ ] Response times are acceptable
- [ ] Correct image version deployed

**✅ Deployment Verified** - If all checks pass, deployment is successful.

**❌ Verification Failed** - If any check fails, see [Troubleshooting](#troubleshooting) section.

---

## Troubleshooting

Common issues and their solutions during manual deployment.

### Issue 1: Docker Build Fails

**Symptom**: `docker build` command fails with errors

**Possible Causes & Solutions**:

```bash
# Problem: Prisma generation fails
# Solution: Check schema file exists
ls -la packages/api/prisma/schema.sqlserver.prisma

# Problem: TypeScript compilation errors
# Solution: Run typecheck to see errors
cd packages/api
pnpm run typecheck
cd ../..

# Problem: Out of disk space
# Solution: Clean up Docker images
docker system df
docker system prune -a --volumes
# WARNING: This removes all unused images and volumes!

# Problem: Network timeout during pnpm install
# Solution: Retry build with longer timeout
docker build --network=host -t spectree-api:latest -f packages/api/Dockerfile.azure .

# Problem: Build cache issues
# Solution: Build without cache
docker build --no-cache -t spectree-api:latest -f packages/api/Dockerfile.azure .
```

### Issue 2: ACR Push Fails

**Symptom**: `docker push` fails or hangs

**Possible Causes & Solutions**:

```bash
# Problem: Not logged in to ACR
# Solution: Login again
az acr login --name $ACR_NAME

# Problem: Insufficient permissions
# Solution: Check your role assignments
az role assignment list \
  --assignee $(az ad signed-in-user show --query id -o tsv) \
  --scope $(az acr show --name $ACR_NAME --query id -o tsv) \
  --output table

# Required role: AcrPush or Contributor

# Problem: Network connectivity
# Solution: Test ACR reachability
curl -I https://$ACR_NAME.azurecr.io/v2/

# Expected: HTTP 401 (authentication required, but reachable)

# Problem: Image size too large
# Solution: Check image size and increase timeout
docker images spectree-api:latest
# If > 1GB, push may take several minutes

# Push with verbose output
docker push --log-level debug $ACR_NAME.azurecr.io/spectree-api:latest
```

### Issue 3: SQL Firewall Rule Not Working

**Symptom**: Cannot connect to database despite firewall rule

**Possible Causes & Solutions**:

```bash
# Problem: IP address changed
# Solution: Check current IP and update rule
CURRENT_IP=$(curl -s ifconfig.me)
echo "Current IP: $CURRENT_IP"

# List existing rules to see if IP matches
az sql server firewall-rule list \
  --resource-group $RESOURCE_GROUP \
  --server $SQL_SERVER \
  --output table

# Delete old rule and create new one
az sql server firewall-rule delete \
  --resource-group $RESOURCE_GROUP \
  --server $SQL_SERVER \
  --name $RULE_NAME

az sql server firewall-rule create \
  --resource-group $RESOURCE_GROUP \
  --server $SQL_SERVER \
  --name $RULE_NAME \
  --start-ip-address $CURRENT_IP \
  --end-ip-address $CURRENT_IP

# Problem: Firewall rule not yet active
# Solution: Wait 30 seconds and retry
sleep 30
pnpm run db:push:sqlserver

# Problem: SQL Server public access disabled
# Solution: Check and enable public network access
az sql server show \
  --resource-group $RESOURCE_GROUP \
  --name $SQL_SERVER \
  --query publicNetworkAccess \
  --output tsv

# If "Disabled", enable it (requires elevated permissions)
az sql server update \
  --resource-group $RESOURCE_GROUP \
  --name $SQL_SERVER \
  --enable-public-network true
```

### Issue 4: Schema Push Fails

**Symptom**: `pnpm run db:push:sqlserver` fails

**Possible Causes & Solutions**:

```bash
# Problem: Connection string malformed
# Solution: Verify format
echo $SQLSERVER_DATABASE_URL
# Should be: sqlserver://SERVER.database.windows.net:1433;database=DB;user=USER;password=PASS;encrypt=true

# Problem: Wrong schema file
# Solution: Verify you're using SQL Server schema
cd packages/api
pnpm exec prisma validate --schema=prisma/schema.sqlserver.prisma

# Problem: Schema conflicts
# Solution: Reset database (USE WITH CAUTION IN PRODUCTION!)
# This will DELETE ALL DATA
pnpm exec prisma db push --schema=prisma/schema.sqlserver.prisma --force-reset
# Only use --force-reset in dev environments!

# Problem: Permissions on database
# Solution: Check SQL user has necessary permissions
# Login to Azure Portal -> SQL Database -> Query Editor
# Run: SELECT USER_NAME(), IS_MEMBER('db_owner')
# Expected: User should be db_owner or have ddl_admin rights

cd ../..
```

### Issue 5: Container App Update Fails

**Symptom**: `az containerapp update` fails or new revision unhealthy

**Possible Causes & Solutions**:

```bash
# Problem: Image not found in ACR
# Solution: Verify image exists
az acr repository show \
  --name $ACR_NAME \
  --repository spectree-api \
  --output table

az acr repository show-tags \
  --name $ACR_NAME \
  --repository spectree-api \
  --output table

# Problem: Container App doesn't have ACR pull permission
# Solution: Grant managed identity ACR pull role
IDENTITY_ID=$(az containerapp show \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --query "identity.principalId" -o tsv)

ACR_ID=$(az acr show --name $ACR_NAME --query id -o tsv)

az role assignment create \
  --assignee $IDENTITY_ID \
  --role "AcrPull" \
  --scope $ACR_ID

# Problem: New revision failing health checks
# Solution: Check revision logs
az containerapp revision list \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --output table

# Get the latest revision name
LATEST_REVISION=$(az containerapp revision list \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --query "[0].name" \
  --output tsv)

# Check logs for that specific revision
az containerapp logs show \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --revision $LATEST_REVISION \
  --tail 100

# Problem: Environment variable missing
# Solution: Check and set required variables
az containerapp show \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --query "properties.template.containers[0].env[].name" \
  --output tsv

# Set missing variable
az containerapp update \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --set-env-vars "VARIABLE_NAME=value"
```

### Issue 6: Application Not Responding

**Symptom**: Health endpoint returns 503 or times out

**Possible Causes & Solutions**:

```bash
# Problem: Application still starting up
# Solution: Wait 2-3 minutes for initialization
sleep 120
curl -i https://$APP_URL/health

# Problem: Database connection failing
# Solution: Check DATABASE_URL environment variable
az containerapp show \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --query "properties.template.containers[0].env[?name=='DATABASE_URL']" \
  --output table

# Check logs for database errors
az containerapp logs show \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --tail 100 | grep -i "database\|connection\|prisma"

# Problem: Wrong port configured
# Solution: Verify ingress configuration
az containerapp show \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --query "properties.configuration.ingress.{targetPort:targetPort, external:external}" \
  --output table

# Expected: targetPort = 3001, external = true

# Problem: Replica failing to start
# Solution: Check replica status
az containerapp replica list \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --revision <revision-name> \
  --output table
```

### Issue 7: Logs Show Errors

**Symptom**: Application logs contain errors or exceptions

**Common Errors & Solutions**:

```bash
# Error: "Prisma Client did not initialize yet"
# Solution: Database URL not set correctly, check environment variable
az containerapp update \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --set-env-vars "DATABASE_URL=sqlserver://..."

# Error: "ECONNREFUSED" or "Connection refused"
# Solution: Database not accessible, check firewall rules on SQL Server
# Container Apps should use VNet integration, not firewall rules
# Verify Container App VNet integration is configured

# Error: "Invalid `prisma.xxx.findXXX()` invocation"
# Solution: Schema mismatch - redeploy schema
# Add temp firewall rule, push schema, remove rule

# Error: "Cannot find module"
# Solution: Dependencies missing - rebuild image
docker build --no-cache -t spectree-api:latest -f packages/api/Dockerfile.azure .

# Error: "Port 3001 is already in use"
# Solution: This shouldn't happen in Container Apps (isolated containers)
# If it does, restart the revision
az containerapp revision restart \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --revision <revision-name>
```

### Getting Additional Help

If issues persist:

1. **Collect diagnostic information**:
   ```bash
   # Save logs to file
   az containerapp logs show \
     --name $CONTAINER_APP \
     --resource-group $RESOURCE_GROUP \
     --tail 500 > deployment-logs.txt
   
   # Save configuration
   az containerapp show \
     --name $CONTAINER_APP \
     --resource-group $RESOURCE_GROUP > containerapp-config.json
   
   # Save revision list
   az containerapp revision list \
     --name $CONTAINER_APP \
     --resource-group $RESOURCE_GROUP > revisions.json
   ```

2. **Check Azure Portal**:
   - Navigate to Container App → Revision Management
   - Review Log Stream for real-time logs
   - Check Metrics for CPU/Memory/Requests
   - Review Application Insights (if configured)

3. **Review related documentation**:
   - [azure-deployment-guide.md](./azure-deployment-guide.md) - Full deployment guide
   - [database-multi-provider.md](./database-multi-provider.md) - Database configuration
   - [Azure Container Apps documentation](https://learn.microsoft.com/en-us/azure/container-apps/)

---

## Rollback Procedures

If the deployment fails or introduces critical issues, rollback to the previous revision.

### Quick Rollback

```bash
# List revisions to find previous stable revision
az containerapp revision list \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --output table

# Identify the previous revision (second in list, not active)
PREVIOUS_REVISION=$(az containerapp revision list \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --query "[1].name" \
  --output tsv)

echo "Rolling back to: $PREVIOUS_REVISION"

# Activate previous revision (this deactivates current)
az containerapp revision activate \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --revision $PREVIOUS_REVISION

# Verify rollback
az containerapp revision list \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --output table

# Expected: Previous revision now shows Active=True

# Test application
curl -i https://$APP_URL/health

# Expected: HTTP/2 200 OK
```

### Rollback with Traffic Split

For gradual rollback or testing:

```bash
# Split traffic between new and old revision
az containerapp ingress traffic set \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --revision-weight $PREVIOUS_REVISION=100 <current-revision>=0

# Or split 50/50 for testing
az containerapp ingress traffic set \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --revision-weight $PREVIOUS_REVISION=50 <current-revision>=50

# Monitor both revisions
az containerapp logs show \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --follow
```

### Rollback Checklist

- [ ] Identified previous stable revision
- [ ] Activated previous revision
- [ ] Verified previous revision is receiving traffic
- [ ] Tested health endpoint
- [ ] Checked logs for errors
- [ ] Documented rollback reason
- [ ] Planned fix for failed deployment

### Post-Rollback Actions

1. **Investigate failure**: Review logs and error messages
2. **Fix issues**: Address root cause of deployment failure
3. **Test locally**: Verify fix works in local environment
4. **Document**: Add lessons learned to troubleshooting guide
5. **Retry deployment**: Follow manual deployment procedure again

---

## Quick Reference

### Essential Commands

```bash
# Pre-deployment
az login
az account set --subscription "<subscription>"
export ACR_NAME="<acr-name>"
export RESOURCE_GROUP="rg-spectree-dev"
export SQL_SERVER="sql-spectree-dev"
export CONTAINER_APP="ca-spectree-dev"

# Build and push
docker build -t spectree-api:latest -f packages/api/Dockerfile.azure .
docker tag spectree-api:latest $ACR_NAME.azurecr.io/spectree-api:latest
docker push $ACR_NAME.azurecr.io/spectree-api:latest

# Deploy schema
az sql server firewall-rule create --resource-group $RESOURCE_GROUP --server $SQL_SERVER --name "TempDeploy-$(whoami)" --start-ip-address $(curl -s ifconfig.me) --end-ip-address $(curl -s ifconfig.me)
cd packages/api && pnpm run db:push:sqlserver && cd ../..
az sql server firewall-rule delete --resource-group $RESOURCE_GROUP --server $SQL_SERVER --name "TempDeploy-$(whoami)"

# Update app
az containerapp update --name $CONTAINER_APP --resource-group $RESOURCE_GROUP --image $ACR_NAME.azurecr.io/spectree-api:latest

# Verify
curl -i https://$(az containerapp show --name $CONTAINER_APP --resource-group $RESOURCE_GROUP --query properties.configuration.ingress.fqdn -o tsv)/health

# Logs
az containerapp logs show --name $CONTAINER_APP --resource-group $RESOURCE_GROUP --follow
```

### Deployment Time Estimates

| Step | Duration | Notes |
|------|----------|-------|
| Docker build | 2-5 min | Depends on machine specs |
| Docker push | 1-3 min | Depends on network speed |
| Schema deployment | 30-60 sec | Includes firewall setup/teardown |
| Container update | 2-5 min | Includes health check wait |
| Total deployment | ~8-15 min | Normal deployment |

### Resource Names Reference

Update these for your environment:

| Resource | Default Name | Environment Variable |
|----------|-------------|---------------------|
| Resource Group | `rg-spectree-dev` | `$RESOURCE_GROUP` |
| Container App | `ca-spectree-dev` | `$CONTAINER_APP` |
| SQL Server | `sql-spectree-dev` | `$SQL_SERVER` |
| SQL Database | `sqldb-spectree-dev` | `$SQL_DATABASE` |
| ACR | `acrspectreedev` | `$ACR_NAME` |

---

## Appendix: Automation Opportunities

This manual runbook contains processes that should eventually be automated:

1. **CI/CD Pipeline** - Automate build, push, and deploy on git push
2. **Schema Migrations** - Use GitHub Actions with service principal and VNet integration
3. **Rollback Automation** - Automated rollback on health check failures
4. **Firewall Management** - Use VNet integration instead of public firewall rules
5. **Monitoring Alerts** - Automated alerts on deployment failures

See [github-actions-azure-setup.md](./github-actions-azure-setup.md) for CI/CD automation guidance.

---

**Document Version**: 1.0  
**Last Updated**: 2026-02-09  
**Maintained By**: SpecTree Team

