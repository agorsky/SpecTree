# Azure Deployment Guide

> **SpecTree Azure Deployment**
>
> This guide covers deploying SpecTree to Azure with enterprise-grade security, including Azure Key Vault for secrets management and secure database connectivity.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Azure Resources Required](#azure-resources-required)
5. [Deployment Options](#deployment-options)
6. [Step-by-Step Deployment](#step-by-step-deployment)
7. [Environment Variables Reference](#environment-variables-reference)
8. [MCP Configuration for Azure](#mcp-configuration-for-azure)
9. [Troubleshooting](#troubleshooting)
10. [Cost Estimation](#cost-estimation)

---

## Overview

This guide covers deploying the SpecTree API server to Azure with:

- **Azure Container Apps** for serverless container hosting
- **Azure Key Vault** for secure secrets management
- **Azure SQL Database** or **SQLite on Azure Files** for data persistence
- **Managed Identity** for password-less Azure service authentication

### What You'll Achieve

- Secure, production-ready deployment
- Secrets stored in Azure Key Vault (not environment variables)
- Private network connectivity for database access
- Automatic HTTPS with managed certificates
- Easy scaling and zero-downtime deployments

---

## Architecture

### Production Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              Azure Subscription                                  │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                           Resource Group                                   │  │
│  │  ┌─────────────────────────────────────────────────────────────────────┐  │  │
│  │  │                         Virtual Network                              │  │  │
│  │  │   ┌────────────────────┐    ┌───────────────────────────────────┐   │  │  │
│  │  │   │  Container Apps    │    │     Private Endpoints Subnet      │   │  │  │
│  │  │   │      Subnet        │    │  • SQL Server Private Endpoint    │   │  │  │
│  │  │   │                    │    │  • Key Vault Private Endpoint     │   │  │  │
│  │  │   └────────────────────┘    └───────────────────────────────────┘   │  │  │
│  │  └─────────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                            │  │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐         │  │
│  │  │  Container Apps  │  │   SQL Server     │  │    Key Vault     │         │  │
│  │  │  SpecTree API    │  │   (Private)      │  │    (Private)     │         │  │
│  │  │  + Web Frontend  │  │                  │  │                  │         │  │
│  │  └────────┬─────────┘  └────────▲─────────┘  └────────▲─────────┘         │  │
│  │           │                     │                     │                    │  │
│  │           │ Managed Identity    │ Private Endpoint    │ Managed Identity   │  │
│  │           └─────────────────────┴─────────────────────┘                    │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
          │
          │ HTTPS (443)
          ▼
    ┌───────────────┐
    │   Internet    │
    │   (Users)     │
    └───────────────┘
```

### Security Features

| Feature | Implementation |
|---------|---------------|
| **Secrets Management** | Azure Key Vault with RBAC |
| **Network Security** | Private endpoints, no public DB access |
| **Authentication** | Managed Identity (password-less) |
| **Encryption** | TLS 1.2+ in transit, encryption at rest |
| **Access Control** | Azure RBAC for all resources |

---

## Prerequisites

### Required Tools

```bash
# Azure CLI (2.50+)
az --version

# Bicep CLI (included with Azure CLI)
az bicep version

# Node.js (20+)
node --version
```

### Azure Requirements

- Azure subscription with Owner or Contributor access
- Azure AD permissions to create service principals (for CI/CD)
- Resource provider registrations:
  ```bash
  az provider register --namespace Microsoft.App
  az provider register --namespace Microsoft.KeyVault
  az provider register --namespace Microsoft.Sql
  ```

### Local Requirements

- Docker (for building container images)
- Git (for cloning the repository)

---

## Azure Resources Required

### Recommended Configuration

| Resource | Purpose | SKU/Tier | Estimated Cost |
|----------|---------|----------|----------------|
| Container Apps | Host API + Web | Consumption | ~$0 - $50/mo |
| Key Vault | Secrets management | Standard | ~$0.03/10K ops |
| SQL Database | Data persistence | Basic (S0) | ~$5 - $15/mo |
| Virtual Network | Private connectivity | Standard | ~$0 |
| Private Endpoints | Secure connections | — | ~$7/mo each |

### Alternative: SQLite with Azure Files

For single-user or development deployments:

| Resource | Purpose | SKU/Tier | Estimated Cost |
|----------|---------|----------|----------------|
| Container Apps | Host API + Web | Consumption | ~$0 - $50/mo |
| Key Vault | Secrets management | Standard | ~$0.03/10K ops |
| Storage Account | SQLite database file | Standard LRS | ~$0.02/GB |

---

## Deployment Options

### Option A: Infrastructure as Code (Recommended)

Use the Bicep templates in `/infra` for automated, repeatable deployments.

**Best for:** Production, team environments, CI/CD

### Option B: Azure Portal

Manual deployment through the Azure Portal.

**Best for:** Learning, quick prototypes

### Option C: Azure CLI

Step-by-step CLI commands for full control.

**Best for:** Customization, understanding each component

---

## Step-by-Step Deployment

### Option A: Using Bicep Templates (Recommended)

The SpecTree repository includes production-ready Bicep templates.

#### 1. Clone and Navigate

```bash
git clone https://github.com/your-org/spectree.git
cd spectree/infra
```

#### 2. Configure Parameters

Create a parameters file for your environment:

```bash
# Copy the example parameters
cp parameters/dev.bicepparam parameters/myenv.bicepparam
```

Edit `parameters/myenv.bicepparam`:

```bicep
using '../main.bicep'

param environment = 'dev'
param location = 'eastus'
param baseName = 'spectree'
param sqlAdminLogin = 'sqladmin'
param sqlAdminPassword = '<secure-password-here>'
param sqlAadAdminObjectId = '<your-azure-ad-group-object-id>'
param sqlAadAdminLogin = 'SpecTree Admins'
param sqlAppUserLogin = 'spectree_app'
param sqlAppUserPassword = '<secure-app-password>'
```

#### 3. Deploy Infrastructure

```bash
# Login to Azure
az login

# Set your subscription
az account set --subscription "<your-subscription-id>"

# Deploy
./deploy.sh dev
```

#### 4. Build and Push Container Image

```bash
# Navigate to repository root
cd ..

# Build the container
docker build -t spectree-api:latest -f packages/api/Dockerfile .

# Login to Azure Container Registry (created by Bicep)
az acr login --name <your-acr-name>

# Tag and push
docker tag spectree-api:latest <your-acr-name>.azurecr.io/spectree-api:latest
docker push <your-acr-name>.azurecr.io/spectree-api:latest
```

#### 5. Update Container App

```bash
az containerapp update \
  --name ca-spectree-dev \
  --resource-group rg-spectree-dev \
  --image <your-acr-name>.azurecr.io/spectree-api:latest
```

---

### Option B: Azure CLI Step-by-Step

For full control or learning purposes.

#### 1. Create Resource Group

```bash
# Set variables
RESOURCE_GROUP="rg-spectree-dev"
LOCATION="eastus"

# Create resource group
az group create \
  --name $RESOURCE_GROUP \
  --location $LOCATION
```

#### 2. Create Key Vault

```bash
KEY_VAULT_NAME="kv-spectree-dev"

# Create Key Vault
az keyvault create \
  --name $KEY_VAULT_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --enable-rbac-authorization true

# Add secrets
az keyvault secret set \
  --vault-name $KEY_VAULT_NAME \
  --name "jwt-secret" \
  --value "$(openssl rand -base64 32)"
```

#### 3. Create Storage Account (for SQLite)

```bash
STORAGE_ACCOUNT="stspectreedev"

# Create storage account
az storage account create \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --sku Standard_LRS

# Create file share
az storage share create \
  --name "spectree-data" \
  --account-name $STORAGE_ACCOUNT
```

#### 4. Create Container Apps Environment

```bash
# Create environment
az containerapp env create \
  --name cae-spectree-dev \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION

# Add storage mount
az containerapp env storage set \
  --name cae-spectree-dev \
  --resource-group $RESOURCE_GROUP \
  --storage-name spectreedata \
  --azure-file-account-name $STORAGE_ACCOUNT \
  --azure-file-account-key $(az storage account keys list -n $STORAGE_ACCOUNT --query '[0].value' -o tsv) \
  --azure-file-share-name spectree-data \
  --access-mode ReadWrite
```

#### 5. Deploy Container App

```bash
# Get Key Vault URI
KEY_VAULT_URI=$(az keyvault show -n $KEY_VAULT_NAME --query properties.vaultUri -o tsv)

# Create container app
az containerapp create \
  --name ca-spectree-dev \
  --resource-group $RESOURCE_GROUP \
  --environment cae-spectree-dev \
  --image ghcr.io/your-org/spectree-api:latest \
  --target-port 3001 \
  --ingress external \
  --min-replicas 0 \
  --max-replicas 3 \
  --env-vars \
    NODE_ENV=production \
    SECRETS_PROVIDER=azure-keyvault \
    AZURE_KEYVAULT_URL=$KEY_VAULT_URI \
    DATABASE_URL=file:/mnt/data/spectree.db \
  --system-assigned
```

#### 6. Grant Key Vault Access

```bash
# Get Container App's managed identity
IDENTITY=$(az containerapp show \
  -n ca-spectree-dev \
  -g $RESOURCE_GROUP \
  --query identity.principalId -o tsv)

# Get Key Vault resource ID
KEY_VAULT_ID=$(az keyvault show -n $KEY_VAULT_NAME --query id -o tsv)

# Grant Key Vault Secrets User role
az role assignment create \
  --role "Key Vault Secrets User" \
  --assignee $IDENTITY \
  --scope $KEY_VAULT_ID
```

---

## Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `SECRETS_PROVIDER` | Secrets backend | `azure-keyvault` |
| `AZURE_KEYVAULT_URL` | Key Vault URL | `https://kv-spectree-dev.vault.azure.net` |
| `DATABASE_URL` | Database connection | `file:/mnt/data/spectree.db` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | API server port | `3001` |
| `HOST` | Bind address | `0.0.0.0` |
| `CORS_ORIGIN` | Allowed CORS origins | `*` |

### Key Vault Secret Names

The API maps environment variable names to Key Vault secrets:

| Environment Variable | Key Vault Secret Name |
|---------------------|----------------------|
| `JWT_SECRET` | `jwt-secret` |
| `DATABASE_URL` | `database-url` (optional) |

---

## MCP Configuration for Azure

Once deployed, configure MCP to use the Azure-hosted API.

### Generate API Token

```bash
# Get the API URL
API_URL=$(az containerapp show \
  -n ca-spectree-dev \
  -g rg-spectree-dev \
  --query properties.configuration.ingress.fqdn -o tsv)

echo "API URL: https://$API_URL"

# Generate token via web UI or API
# 1. Open https://$API_URL in browser
# 2. Log in and go to Settings → API Tokens
# 3. Create a new token named "MCP"
```

### Configure MCP

Update your MCP configuration file (usually `~/.config/github-copilot/mcp.json`):

```json
{
  "mcpServers": {
    "spectree": {
      "command": "node",
      "args": ["/path/to/spectree/packages/mcp/dist/index.js"],
      "env": {
        "API_TOKEN": "st_your_token_here",
        "API_BASE_URL": "https://ca-spectree-dev.azurecontainerapps.io"
      }
    }
  }
}
```

### Verify Connection

Test the MCP connection by asking Copilot to list SpecTree projects.

---

## Troubleshooting

### Key Vault Access Denied

**Error:** `SecretClient failed to retrieve secret`

**Solutions:**

1. Verify managed identity is enabled:
   ```bash
   az containerapp show -n ca-spectree-dev -g rg-spectree-dev \
     --query identity
   ```

2. Check RBAC assignment:
   ```bash
   az role assignment list --scope $(az keyvault show -n kv-spectree-dev --query id -o tsv)
   ```

3. Ensure Key Vault allows Azure services:
   ```bash
   az keyvault show -n kv-spectree-dev --query properties.networkAcls
   ```

### Container App Not Starting

**Error:** Container exits immediately or fails health checks

**Solutions:**

1. Check container logs:
   ```bash
   az containerapp logs show \
     -n ca-spectree-dev \
     -g rg-spectree-dev \
     --follow
   ```

2. Verify environment variables:
   ```bash
   az containerapp show -n ca-spectree-dev -g rg-spectree-dev \
     --query properties.template.containers[0].env
   ```

3. Test locally with same environment:
   ```bash
   docker run -e NODE_ENV=production \
     -e SECRETS_PROVIDER=env \
     -e JWT_SECRET=test \
     -e DATABASE_URL=file:./test.db \
     spectree-api:latest
   ```

### Database Connection Issues

**Error:** `SQLITE_CANTOPEN` or connection refused

**Solutions:**

1. For Azure Files mount, verify storage is connected:
   ```bash
   az containerapp env storage show \
     --name cae-spectree-dev \
     -g rg-spectree-dev \
     --storage-name spectreedata
   ```

2. Check file share permissions:
   ```bash
   az storage share show \
     --name spectree-data \
     --account-name stspectreedev
   ```

### Cold Start Performance

**Issue:** First request after idle period is slow (5-10 seconds)

**Solutions:**

1. Set minimum replicas to 1:
   ```bash
   az containerapp update \
     -n ca-spectree-dev \
     -g rg-spectree-dev \
     --min-replicas 1
   ```

2. Configure health probes for faster startup detection

### MCP Connection Failed

**Error:** MCP cannot reach Azure API

**Solutions:**

1. Verify API URL is accessible:
   ```bash
   curl https://ca-spectree-dev.azurecontainerapps.io/api/health
   ```

2. Check API token is valid (not expired)

3. Verify `API_BASE_URL` does not have trailing slash

---

## Cost Estimation

### Development Environment

| Resource | Configuration | Monthly Cost |
|----------|--------------|--------------|
| Container Apps | Consumption, 0-1 replicas | $0 - $10 |
| Key Vault | Standard, ~1K operations | ~$0.10 |
| Storage Account | Standard LRS, 1 GB | ~$0.02 |
| **Total** | | **~$0.12 - $10** |

### Production Environment

| Resource | Configuration | Monthly Cost |
|----------|--------------|--------------|
| Container Apps | Consumption, 1-5 replicas | $20 - $100 |
| Key Vault | Standard, ~100K operations | ~$3 |
| SQL Database | Basic (S0) | ~$15 |
| Virtual Network | Standard | ~$0 |
| Private Endpoints | 2 endpoints | ~$14 |
| **Total** | | **~$52 - $132** |

### Cost Optimization Tips

1. Use consumption tier for Container Apps
2. Set `min-replicas: 0` for non-critical environments
3. Use SQLite on Azure Files instead of SQL Database for small teams
4. Clean up unused resources regularly

---

## Related Documentation

- [Security Architecture](./security-architecture.md) — Understanding the security model
- [Migration Guide](./migration-guide.md) — Migrating from local to Azure
- [API Token Authentication](./api-token-authentication.md) — Token management details
- [Infrastructure README](/infra/README.md) — Detailed Bicep documentation

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-29 | Initial document created for ENG-6-4 |
