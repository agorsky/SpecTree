# SpecTree Azure Deployment Guide

> **Comprehensive guide for deploying SpecTree to Microsoft Azure**
>
> This document provides detailed analysis of the SpecTree application architecture, deployment options, step-by-step instructions, and best practices for production deployment on Azure. It is designed to be used by developers, DevOps engineers, or AI assistants helping with deployment.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Application Architecture Analysis](#application-architecture-analysis)
3. [Azure Architecture Overview](#azure-architecture-overview)
4. [Deployment Options Comparison](#deployment-options-comparison)
5. [Prerequisites](#prerequisites)
6. [Recommended Deployment: Azure Container Apps](#recommended-deployment-azure-container-apps)
7. [Alternative Deployment: Azure App Service](#alternative-deployment-azure-app-service)
8. [Alternative Deployment: Azure Kubernetes Service (AKS)](#alternative-deployment-azure-kubernetes-service-aks)
9. [Database Options](#database-options)
10. [CI/CD Pipeline Setup](#cicd-pipeline-setup)
11. [Security Best Practices](#security-best-practices)
12. [Monitoring and Observability](#monitoring-and-observability)
13. [Cost Optimization](#cost-optimization)
14. [Disaster Recovery](#disaster-recovery)
15. [Troubleshooting Guide](#troubleshooting-guide)
16. [Quick Reference Commands](#quick-reference-commands)

---

## Executive Summary

### What is SpecTree?

SpecTree is a **project management and issue tracking platform** similar to Linear, consisting of:

- **API Backend** (`@spectree/api`): Fastify REST API with Prisma ORM
- **Web Frontend** (`@spectree/web`): React SPA with Vite, Tailwind CSS, and Radix UI
- **MCP Server** (`@spectree/mcp`): Model Context Protocol server for AI integrations (Claude, GitHub Copilot)
- **Shared Types** (`@spectree/shared`): TypeScript type definitions

### Key Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Runtime | Node.js | 20+ |
| Package Manager | pnpm | 9+ |
| API Framework | Fastify | 5.x |
| Frontend | React | 19.x |
| Build Tool | Vite | 6.x |
| Database (Dev) | SQLite | - |
| Database (Prod) | Azure SQL | - |
| ORM | Prisma | 6.x |
| Infrastructure | Azure Bicep | - |

### Recommended Azure Services

For most deployments, we recommend:

| Component | Azure Service | Rationale |
|-----------|---------------|-----------|
| Application Hosting | **Azure Container Apps** | Serverless containers, auto-scaling, built-in ingress |
| Database | **Azure SQL Database** | Managed SQL, geo-replication, enterprise features |
| Secrets | **Azure Key Vault** | Secure secret storage with RBAC |
| Container Registry | **Azure Container Registry** | Private Docker image storage |
| CDN (optional) | **Azure Front Door** | Global CDN with WAF |

---

## Application Architecture Analysis

### Monorepo Structure

```
SpecTree/
├── packages/
│   ├── api/              # Fastify backend API (port 3001)
│   │   ├── src/          # TypeScript source
│   │   ├── prisma/       # Database schema and migrations
│   │   ├── Dockerfile    # Production container image
│   │   └── package.json
│   ├── web/              # React frontend (port 5173 dev, 80 prod)
│   │   ├── src/          # React components
│   │   ├── Dockerfile    # Nginx-based production image
│   │   ├── nginx.conf    # Nginx configuration
│   │   └── package.json
│   ├── mcp/              # MCP server for AI integration
│   │   └── src/          # MCP tools implementation
│   └── shared/           # Shared TypeScript types
├── infra/                # Azure Bicep IaC templates
│   ├── main.bicep        # Main orchestration
│   ├── modules/          # Modular Bicep components
│   ├── parameters/       # Environment-specific params
│   └── deploy.sh         # Deployment script
└── docker-compose.yml    # Local containerized development
```

### Package Dependencies

```
@spectree/shared  ─── Base package (no dependencies)
       │
       ├── @spectree/api     (depends on shared)
       ├── @spectree/web     (depends on shared)
       └── @spectree/mcp     (depends on shared, api)
```

### API Architecture

The API follows a layered architecture:

```
Routes (src/routes/)
    │
    ▼
Services (src/services/)
    │
    ▼
Prisma Client (src/generated/prisma/)
    │
    ▼
Database (SQLite local, Azure SQL production)
```

### Database Schema Overview

Key entities (from `packages/api/prisma/schema.prisma`):

- **Team**: Organization unit with epics and statuses
- **User**: User accounts with email/password authentication
- **Epic**: Container for features, belongs to a team
- **Feature**: Primary work items (like issues)
- **Task**: Sub-items under features
- **Status**: Workflow states (backlog, in-progress, done, etc.)
- **ApiToken**: API tokens for MCP and programmatic access

### Container Configuration

**API Container** (`packages/api/Dockerfile`):
- Base: `node:22-alpine`
- Exposes port 3001
- Multi-stage build (builder → runner)
- Runs: `node packages/api/dist/index.js`

**Web Container** (`packages/web/Dockerfile`):
- Base: `node:22-alpine` (build), `nginx:alpine` (runtime)
- Exposes port 80
- Static files served by Nginx
- SPA routing with `try_files`

---

## Azure Architecture Overview

### Production Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Azure Subscription                              │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    Resource Group (rg-spectree-{env})                  │  │
│  │                                                                        │  │
│  │  ┌───────────────────────────────────────────────────────────────┐    │  │
│  │  │                 Virtual Network (10.0.0.0/16)                  │    │  │
│  │  │                                                                │    │  │
│  │  │   ┌─────────────────────┐    ┌─────────────────────────────┐  │    │  │
│  │  │   │  Container Apps     │    │  Private Endpoints Subnet   │  │    │  │
│  │  │   │  Subnet             │    │  (10.0.2.0/24)              │  │    │  │
│  │  │   │  (10.0.0.0/23)      │    │  • SQL Private Endpoint     │  │    │  │
│  │  │   │                     │    │  • Key Vault Private EP     │  │    │  │
│  │  │   │  ┌──────────────┐   │    └─────────────────────────────┘  │    │  │
│  │  │   │  │ Container    │   │                                     │    │  │
│  │  │   │  │ Apps Env     │   │                                     │    │  │
│  │  │   │  │              │   │                                     │    │  │
│  │  │   │  │ ┌─────────┐  │   │                                     │    │  │
│  │  │   │  │ │ API App │  │   │                                     │    │  │
│  │  │   │  │ └────┬────┘  │   │                                     │    │  │
│  │  │   │  │      │       │   │                                     │    │  │
│  │  │   │  │ ┌────▼────┐  │   │                                     │    │  │
│  │  │   │  │ │ Web App │  │   │                                     │    │  │
│  │  │   │  │ └─────────┘  │   │                                     │    │  │
│  │  │   │  └──────────────┘   │                                     │    │  │
│  │  │   └─────────────────────┘                                     │    │  │
│  │  └───────────────────────────────────────────────────────────────┘    │  │
│  │                                                                        │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐    │  │
│  │  │  Azure SQL      │  │  Key Vault      │  │ Container Registry  │    │  │
│  │  │  (Private)      │  │  (Private)      │  │ (ACR)               │    │  │
│  │  │                 │  │                 │  │                     │    │  │
│  │  │  • TLS 1.2+     │  │  • RBAC         │  │  • spectree-api     │    │  │
│  │  │  • TDE enabled  │  │  • Soft delete  │  │  • spectree-web     │    │  │
│  │  │  • Auditing     │  │  • Purge protect│  │                     │    │  │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────────┘    │  │
│  │                                                                        │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │                     Log Analytics Workspace                      │  │  │
│  │  │                 (Centralized logging & monitoring)               │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                    │
                    │ HTTPS (443) - Managed Certificate
                    ▼
              ┌───────────────┐
              │   Internet    │
              │   Users/MCP   │
              └───────────────┘
```

### Resource Naming Convention

The existing Bicep templates use this naming pattern:

| Resource Type | Pattern | Example |
|---------------|---------|---------|
| Resource Group | `rg-{baseName}-{env}` | `rg-spectree-dev` |
| Virtual Network | `vnet-{baseName}-{env}` | `vnet-spectree-dev` |
| Container Apps Env | `cae-{baseName}-{env}` | `cae-spectree-dev` |
| Container App | `ca-{baseName}-{env}` | `ca-spectree-dev` |
| SQL Server | `sql-{baseName}-{env}` | `sql-spectree-dev` |
| SQL Database | `sqldb-{baseName}-{env}` | `sqldb-spectree-dev` |
| Key Vault | `kv-{baseName}-{env}` | `kv-spectree-dev` |
| Log Analytics | `log-{baseName}-{env}` | `log-spectree-dev` |

---

## Deployment Options Comparison

### Option 1: Azure Container Apps (Recommended)

**Best for:** Most deployments, serverless requirements, cost optimization

| Pros | Cons |
|------|------|
| Serverless, auto-scaling | Less control than Kubernetes |
| Built-in ingress with HTTPS | Fewer advanced networking options |
| Consumption-based pricing | Cold starts possible with 0 replicas |
| Managed environment | Limited custom configurations |
| Simple deployment model | |

**Estimated Cost:** $0 - $100/month (consumption-based)

### Option 2: Azure App Service

**Best for:** Teams familiar with PaaS, simple deployments

| Pros | Cons |
|------|------|
| Very simple deployment | More expensive at scale |
| Built-in CI/CD integration | Less container flexibility |
| Deployment slots | Fixed pricing tiers |
| Easy SSL certificates | |

**Estimated Cost:** $13 - $200+/month (B1 to P1v3)

### Option 3: Azure Kubernetes Service (AKS)

**Best for:** Large teams, complex microservices, Kubernetes expertise

| Pros | Cons |
|------|------|
| Full Kubernetes control | Requires Kubernetes expertise |
| Advanced networking | More complex setup |
| Custom ingress controllers | Higher operational overhead |
| Helm chart deployments | More expensive minimum |

**Estimated Cost:** $70 - $500+/month

### Recommendation Matrix

| Scenario | Recommended Option |
|----------|-------------------|
| Personal project / learning | Container Apps (0 replicas) |
| Small team (< 10 users) | Container Apps |
| Medium team (10-100 users) | Container Apps or App Service |
| Enterprise (100+ users) | AKS or Container Apps |
| Existing Kubernetes expertise | AKS |
| Simplest possible setup | App Service |

---

## Prerequisites

### 1. Azure Account Setup

```bash
# 1. Install Azure CLI
# macOS
brew install azure-cli

# Windows
winget install Microsoft.AzureCLI

# Linux
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# 2. Login to Azure
az login

# 3. List subscriptions
az account list --output table

# 4. Set default subscription
az account set --subscription "<subscription-name-or-id>"

# 5. Verify
az account show
```

### 2. Register Required Resource Providers

```bash
# Required providers for Container Apps deployment
az provider register --namespace Microsoft.App
az provider register --namespace Microsoft.ContainerRegistry
az provider register --namespace Microsoft.KeyVault
az provider register --namespace Microsoft.Sql
az provider register --namespace Microsoft.OperationalInsights

# Check registration status
az provider show --namespace Microsoft.App --query "registrationState"
```

### 3. Install Required Tools

```bash
# Verify Node.js (20+)
node --version

# Verify pnpm (9+)
pnpm --version

# Install Bicep CLI (included with Azure CLI)
az bicep install
az bicep version

# Install Docker (for building images)
docker --version
```

### 4. Clone and Build Application

```bash
# Clone repository
git clone <repository-url>
cd SpecTree

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Verify build succeeded
ls -la packages/api/dist/
ls -la packages/web/dist/
```

---

## Recommended Deployment: Azure Container Apps

This section provides step-by-step instructions using the existing Bicep infrastructure.

### Step 1: Create Azure Container Registry

Before deploying infrastructure, create a container registry to store Docker images:

```bash
# Variables
RESOURCE_GROUP="rg-spectree-shared"
LOCATION="eastus"
ACR_NAME="acrspectree$(openssl rand -hex 4)"  # Must be globally unique

# Create resource group for shared resources
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create Azure Container Registry
az acr create \
  --resource-group $RESOURCE_GROUP \
  --name $ACR_NAME \
  --sku Basic \
  --admin-enabled true

# Get ACR credentials
az acr credential show --name $ACR_NAME

# Login to ACR
az acr login --name $ACR_NAME

echo "ACR_NAME: $ACR_NAME"
echo "ACR_LOGIN_SERVER: $ACR_NAME.azurecr.io"
```

### Step 2: Build and Push Docker Images

```bash
# Navigate to repository root
cd /path/to/SpecTree

# Build API image
docker build -t spectree-api:latest -f packages/api/Dockerfile .

# Build Web image
docker build -t spectree-web:latest -f packages/web/Dockerfile .

# Tag images for ACR
docker tag spectree-api:latest $ACR_NAME.azurecr.io/spectree-api:v1.0.0
docker tag spectree-api:latest $ACR_NAME.azurecr.io/spectree-api:latest
docker tag spectree-web:latest $ACR_NAME.azurecr.io/spectree-web:v1.0.0
docker tag spectree-web:latest $ACR_NAME.azurecr.io/spectree-web:latest

# Push images to ACR
docker push $ACR_NAME.azurecr.io/spectree-api:v1.0.0
docker push $ACR_NAME.azurecr.io/spectree-api:latest
docker push $ACR_NAME.azurecr.io/spectree-web:v1.0.0
docker push $ACR_NAME.azurecr.io/spectree-web:latest

# Verify images
az acr repository list --name $ACR_NAME
az acr repository show-tags --name $ACR_NAME --repository spectree-api
```

### Step 3: Prepare Deployment Parameters

Create a secure parameters file (DO NOT commit to source control):

```bash
cd infra

# Create secure parameters file
cat > parameters/dev-secrets.bicepparam << 'EOF'
using '../main.bicep'

param environment = 'dev'
param location = 'eastus'
param baseName = 'spectree'

// SQL Server credentials
param sqlAdminLogin = 'sqladmin'
param sqlAdminPassword = '<GENERATE_SECURE_PASSWORD_32_CHARS>'

// Azure AD admin for SQL (your Azure AD group or user)
// Get your object ID: az ad signed-in-user show --query id -o tsv
param sqlAadAdminObjectId = '<YOUR_AZURE_AD_OBJECT_ID>'
param sqlAadAdminLogin = '<YOUR_EMAIL_OR_GROUP_NAME>'
param sqlEnableAadOnlyAuth = false

// Application database user
param sqlAppUserLogin = 'spectree_app'
param sqlAppUserPassword = '<GENERATE_SECURE_PASSWORD_32_CHARS>'

// Container image (update with your ACR)
param containerImage = '<ACR_NAME>.azurecr.io/spectree-api:latest'

param tags = {
  environment: 'dev'
  project: 'spectree'
  owner: '<YOUR_NAME>'
}
EOF

# Add to .gitignore
echo "parameters/*-secrets.bicepparam" >> .gitignore
```

### Step 4: Deploy Infrastructure

```bash
# Validate deployment first
./deploy.sh -e dev --validate

# Preview changes (what-if)
./deploy.sh -e dev --what-if

# Deploy infrastructure
./deploy.sh -e dev

# Note the outputs:
# - Container App FQDN
# - Key Vault name
# - SQL Server name
```

### Step 5: Configure Container App Authentication with ACR

```bash
# Variables (from deployment output)
RESOURCE_GROUP="rg-spectree-dev"
CONTAINER_APP="ca-spectree-dev"
ACR_NAME="<your-acr-name>"

# Get Container App managed identity
IDENTITY_ID=$(az containerapp show \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --query "identity.principalId" -o tsv)

# Grant ACR pull permission
ACR_ID=$(az acr show --name $ACR_NAME --query id -o tsv)
az role assignment create \
  --assignee $IDENTITY_ID \
  --role "AcrPull" \
  --scope $ACR_ID

# Configure Container App to use ACR with managed identity
az containerapp registry set \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --server $ACR_NAME.azurecr.io \
  --identity system
```

### Step 6: Deploy Application Updates

```bash
# Update Container App with new image
az containerapp update \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --image $ACR_NAME.azurecr.io/spectree-api:v1.0.0

# Check deployment status
az containerapp show \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --query "properties.latestRevisionName"

# View logs
az containerapp logs show \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --follow
```

### Step 7: Run Database Migrations

Since the application uses Prisma, you need to run migrations against Azure SQL:

```bash
# Option 1: Run from local machine with temporary firewall rule
# (Only for initial setup - not recommended for production)

# Add your IP to SQL firewall temporarily
MY_IP=$(curl -s ifconfig.me)
az sql server firewall-rule create \
  --resource-group $RESOURCE_GROUP \
  --server sql-spectree-dev \
  --name "TempDevAccess" \
  --start-ip-address $MY_IP \
  --end-ip-address $MY_IP

# Set DATABASE_URL for Azure SQL
export DATABASE_URL="sqlserver://sql-spectree-dev.database.windows.net:1433;database=sqldb-spectree-dev;user=sqladmin;password=<PASSWORD>;encrypt=true"

# Run Prisma migrations
cd packages/api
npx prisma migrate deploy

# Remove firewall rule
az sql server firewall-rule delete \
  --resource-group $RESOURCE_GROUP \
  --server sql-spectree-dev \
  --name "TempDevAccess"
```

### Step 8: Verify Deployment

```bash
# Get the Container App URL
APP_URL=$(az containerapp show \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --query "properties.configuration.ingress.fqdn" -o tsv)

echo "Application URL: https://$APP_URL"

# Test health endpoint
curl -s "https://$APP_URL/api/health" | jq

# Test API endpoint
curl -s "https://$APP_URL/api/v1/teams" | jq
```

---

## Alternative Deployment: Azure App Service

For simpler deployments without container orchestration.

### Step 1: Create App Service Plan and Apps

```bash
# Variables
RESOURCE_GROUP="rg-spectree-appservice"
LOCATION="eastus"
APP_SERVICE_PLAN="asp-spectree"
API_APP_NAME="app-spectree-api"
WEB_APP_NAME="app-spectree-web"

# Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create App Service Plan (Linux, B1 tier)
az appservice plan create \
  --name $APP_SERVICE_PLAN \
  --resource-group $RESOURCE_GROUP \
  --sku B1 \
  --is-linux

# Create API Web App (Node.js)
az webapp create \
  --name $API_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --plan $APP_SERVICE_PLAN \
  --runtime "NODE:20-lts"

# Create Web App for static frontend
az webapp create \
  --name $WEB_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --plan $APP_SERVICE_PLAN \
  --runtime "NODE:20-lts"
```

### Step 2: Configure App Settings

```bash
# API App settings
az webapp config appsettings set \
  --name $API_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings \
    NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0

# Enable system-assigned managed identity
az webapp identity assign \
  --name $API_APP_NAME \
  --resource-group $RESOURCE_GROUP
```

### Step 3: Deploy Using GitHub Actions or ZIP Deploy

```bash
# Build locally
pnpm build

# Create deployment package for API
cd packages/api
zip -r ../../spectree-api.zip dist/ node_modules/ package.json prisma/

# Deploy API
az webapp deployment source config-zip \
  --name $API_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --src ../../spectree-api.zip

# For Web, build and deploy static files
cd ../web
zip -r ../../spectree-web.zip dist/

az webapp deployment source config-zip \
  --name $WEB_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --src ../../spectree-web.zip
```

---

## Alternative Deployment: Azure Kubernetes Service (AKS)

For teams requiring full Kubernetes capabilities.

### Step 1: Create AKS Cluster

```bash
# Variables
RESOURCE_GROUP="rg-spectree-aks"
CLUSTER_NAME="aks-spectree"
LOCATION="eastus"

# Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create AKS cluster
az aks create \
  --resource-group $RESOURCE_GROUP \
  --name $CLUSTER_NAME \
  --node-count 2 \
  --node-vm-size Standard_B2s \
  --enable-managed-identity \
  --enable-addons monitoring \
  --generate-ssh-keys

# Get credentials
az aks get-credentials \
  --resource-group $RESOURCE_GROUP \
  --name $CLUSTER_NAME
```

### Step 2: Create Kubernetes Manifests

Create `k8s/deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: spectree-api
  labels:
    app: spectree-api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: spectree-api
  template:
    metadata:
      labels:
        app: spectree-api
    spec:
      containers:
      - name: api
        image: <ACR_NAME>.azurecr.io/spectree-api:latest
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "3001"
        resources:
          requests:
            cpu: "100m"
            memory: "256Mi"
          limits:
            cpu: "500m"
            memory: "512Mi"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3001
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /api/health/ready
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: spectree-api
spec:
  selector:
    app: spectree-api
  ports:
  - port: 80
    targetPort: 3001
  type: LoadBalancer
```

### Step 3: Deploy to AKS

```bash
# Apply manifests
kubectl apply -f k8s/deployment.yaml

# Check status
kubectl get pods
kubectl get services

# Get external IP
kubectl get service spectree-api -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
```

---

## Database Options

### Option A: Azure SQL Database (Recommended for Production)

The existing Bicep templates deploy Azure SQL with:

- Private endpoint (no public access)
- TLS 1.2 minimum
- Transparent Data Encryption
- Auditing enabled
- Advanced Threat Protection

**Prisma Configuration for Azure SQL:**

```prisma
// schema.prisma
datasource db {
  provider = "sqlserver"
  url      = env("DATABASE_URL")
}
```

**Connection String Format:**

```
sqlserver://<server>.database.windows.net:1433;database=<database>;user=<user>;password=<password>;encrypt=true
```

### Option B: SQLite with Azure Files (Development/Small Teams)

For simpler deployments or development environments:

```bash
# Create Storage Account
az storage account create \
  --name stspectreedata \
  --resource-group $RESOURCE_GROUP \
  --sku Standard_LRS

# Create File Share
az storage share create \
  --name spectree-data \
  --account-name stspectreedata

# Mount in Container Apps
az containerapp env storage set \
  --name cae-spectree-dev \
  --resource-group $RESOURCE_GROUP \
  --storage-name spectreedata \
  --azure-file-account-name stspectreedata \
  --azure-file-account-key $(az storage account keys list -n stspectreedata --query '[0].value' -o tsv) \
  --azure-file-share-name spectree-data \
  --access-mode ReadWrite
```

### Option C: Azure Database for PostgreSQL

If you prefer PostgreSQL:

```bash
# Create PostgreSQL Flexible Server
az postgres flexible-server create \
  --resource-group $RESOURCE_GROUP \
  --name pg-spectree-dev \
  --location $LOCATION \
  --sku-name Standard_B1ms \
  --storage-size 32 \
  --admin-user pgadmin \
  --admin-password '<SECURE_PASSWORD>'
```

**Note:** Requires updating `schema.prisma` to use `postgresql` provider.

---

## CI/CD Pipeline Setup

### GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Azure

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  AZURE_RESOURCE_GROUP: rg-spectree-dev
  AZURE_CONTAINER_APP: ca-spectree-dev
  ACR_NAME: acrspectree

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        
    - name: Install pnpm
      uses: pnpm/action-setup@v2
      with:
        version: 9
        
    - name: Install dependencies
      run: pnpm install
      
    - name: Build
      run: pnpm build
      
    - name: Run tests
      run: pnpm test
      
    - name: Azure Login
      uses: azure/login@v1
      with:
        creds: ${{ secrets.AZURE_CREDENTIALS }}
        
    - name: Login to ACR
      run: az acr login --name ${{ env.ACR_NAME }}
      
    - name: Build and push API image
      run: |
        docker build -t ${{ env.ACR_NAME }}.azurecr.io/spectree-api:${{ github.sha }} -f packages/api/Dockerfile .
        docker push ${{ env.ACR_NAME }}.azurecr.io/spectree-api:${{ github.sha }}
        
    - name: Deploy to Container Apps
      run: |
        az containerapp update \
          --name ${{ env.AZURE_CONTAINER_APP }} \
          --resource-group ${{ env.AZURE_RESOURCE_GROUP }} \
          --image ${{ env.ACR_NAME }}.azurecr.io/spectree-api:${{ github.sha }}
```

### Create Azure Service Principal for GitHub Actions

```bash
# Create service principal with Contributor role
az ad sp create-for-rbac \
  --name "sp-github-spectree" \
  --role contributor \
  --scopes /subscriptions/<subscription-id>/resourceGroups/$RESOURCE_GROUP \
  --sdk-auth

# Copy the JSON output and add as GitHub secret named AZURE_CREDENTIALS
```

---

## Security Best Practices

### 1. Network Security

```bash
# Verify private endpoints are configured
az sql server show \
  --name sql-spectree-dev \
  --resource-group $RESOURCE_GROUP \
  --query publicNetworkAccess

# Should return: "Disabled"
```

### 2. Key Vault for Secrets

Never store secrets in environment variables. Use Key Vault:

```bash
# Store JWT secret
az keyvault secret set \
  --vault-name kv-spectree-dev \
  --name "jwt-secret" \
  --value "$(openssl rand -base64 32)"

# Grant Container App access
IDENTITY=$(az containerapp show -n ca-spectree-dev -g $RESOURCE_GROUP --query identity.principalId -o tsv)
az role assignment create \
  --role "Key Vault Secrets User" \
  --assignee $IDENTITY \
  --scope $(az keyvault show -n kv-spectree-dev --query id -o tsv)
```

### 3. Enable Managed Identity

The Bicep templates already configure User-Assigned Managed Identity for:
- Key Vault access
- ACR pull
- Azure SQL authentication (optional)

### 4. Enable Azure AD Authentication for SQL

For enhanced security, use Azure AD authentication:

```bash
# Set Azure AD only auth (disables SQL auth)
az sql server ad-only-auth enable \
  --resource-group $RESOURCE_GROUP \
  --name sql-spectree-dev
```

### 5. Enable WAF with Azure Front Door (Optional)

For public-facing production deployments:

```bash
# Create Front Door profile with WAF
az afd profile create \
  --resource-group $RESOURCE_GROUP \
  --profile-name fd-spectree \
  --sku Premium_AzureFrontDoor
```

---

## Monitoring and Observability

### Log Analytics Queries

```kusto
// Container App logs
ContainerAppConsoleLogs_CL
| where ContainerAppName_s == "ca-spectree-dev"
| order by TimeGenerated desc
| take 100

// HTTP request metrics
ContainerAppSystemLogs_CL
| where ContainerAppName_s == "ca-spectree-dev"
| where Log_s contains "request"
| order by TimeGenerated desc

// Error logs
ContainerAppConsoleLogs_CL
| where Log_s contains "error" or Log_s contains "Error"
| order by TimeGenerated desc
```

### Set Up Alerts

```bash
# Create alert for high CPU
az monitor metrics alert create \
  --name "High CPU Alert" \
  --resource-group $RESOURCE_GROUP \
  --scopes "/subscriptions/<sub>/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.App/containerApps/ca-spectree-dev" \
  --condition "avg Percentage CPU > 80" \
  --action-group "/subscriptions/<sub>/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.Insights/actionGroups/email-alerts"
```

### Application Insights (Optional)

```bash
# Create Application Insights
az monitor app-insights component create \
  --app appi-spectree-dev \
  --location $LOCATION \
  --resource-group $RESOURCE_GROUP \
  --kind web

# Get instrumentation key
az monitor app-insights component show \
  --app appi-spectree-dev \
  --resource-group $RESOURCE_GROUP \
  --query instrumentationKey
```

---

## Cost Optimization

### Development Environment Costs

| Resource | Configuration | Monthly Cost |
|----------|--------------|--------------|
| Container Apps | Consumption, 0 min replicas | $0 - $10 |
| Key Vault | Standard, ~1K operations | ~$0.10 |
| SQL Database | Basic (S0) | ~$5 |
| Storage (SQLite option) | Standard LRS, 1 GB | ~$0.02 |
| **Total** | | **~$5 - $15** |

### Production Environment Costs

| Resource | Configuration | Monthly Cost |
|----------|--------------|--------------|
| Container Apps | 1-5 replicas | $20 - $100 |
| Key Vault | Standard, 100K ops | ~$3 |
| SQL Database | Standard (S1) | ~$30 |
| Virtual Network | Standard | ~$0 |
| Private Endpoints | 2 endpoints | ~$14 |
| Log Analytics | 5GB/day retention | ~$10 |
| **Total** | | **~$77 - $157** |

### Cost Optimization Tips

1. **Scale to zero**: Set `minReplicas: 0` for non-production
2. **Use reserved capacity**: SQL Database reserved instances save 33-65%
3. **Right-size resources**: Start small, scale up as needed
4. **Clean up**: Delete unused resources regularly
5. **Use consumption tier**: Container Apps consumption pricing is very cost-effective

---

## Disaster Recovery

### Backup Strategy

1. **Database Backups**
   - Azure SQL: Automatic backups with point-in-time restore
   - Geo-redundant backups for production
   - Configure long-term retention

```bash
# Configure long-term backup retention
az sql db ltr-policy set \
  --resource-group $RESOURCE_GROUP \
  --server sql-spectree-dev \
  --database sqldb-spectree-dev \
  --weekly-retention P4W \
  --monthly-retention P12M \
  --yearly-retention P5Y \
  --week-of-year 1
```

2. **Key Vault**
   - Soft delete enabled (90 days)
   - Purge protection enabled
   - Regular secret rotation

3. **Container Registry**
   - Enable geo-replication for ACR Premium
   - Tag images with versions

### Recovery Procedures

```bash
# Restore SQL Database to point in time
az sql db restore \
  --resource-group $RESOURCE_GROUP \
  --server sql-spectree-dev \
  --name sqldb-spectree-dev \
  --dest-name sqldb-spectree-dev-restored \
  --time "2024-01-15T00:00:00Z"

# Recover deleted Key Vault
az keyvault recover \
  --name kv-spectree-dev \
  --resource-group $RESOURCE_GROUP

# Rollback Container App to previous revision
az containerapp revision list \
  --name ca-spectree-dev \
  --resource-group $RESOURCE_GROUP

az containerapp update \
  --name ca-spectree-dev \
  --resource-group $RESOURCE_GROUP \
  --revision-suffix <previous-revision-suffix>
```

---

## Troubleshooting Guide

### Issue: Container App Won't Start

```bash
# Check logs
az containerapp logs show \
  --name ca-spectree-dev \
  --resource-group $RESOURCE_GROUP \
  --follow

# Common causes:
# 1. Missing environment variables
# 2. Database connection failure
# 3. Key Vault access denied
# 4. Health probe failure

# Check environment variables
az containerapp show \
  --name ca-spectree-dev \
  --resource-group $RESOURCE_GROUP \
  --query "properties.template.containers[0].env"
```

### Issue: Database Connection Fails

```bash
# Verify private endpoint
az network private-endpoint show \
  --name pe-sql-spectree-dev \
  --resource-group $RESOURCE_GROUP

# Check DNS resolution from Container App
# (requires exec into container or test deployment)

# Verify firewall rules
az sql server firewall-rule list \
  --resource-group $RESOURCE_GROUP \
  --server sql-spectree-dev
```

### Issue: Key Vault Access Denied

```bash
# Check managed identity
az containerapp show \
  --name ca-spectree-dev \
  --resource-group $RESOURCE_GROUP \
  --query identity

# Verify RBAC assignment
az role assignment list \
  --scope $(az keyvault show -n kv-spectree-dev --query id -o tsv) \
  --output table

# Test Key Vault access
az keyvault secret list \
  --vault-name kv-spectree-dev
```

### Issue: Slow Performance / Cold Starts

```bash
# Set minimum replicas to prevent cold starts
az containerapp update \
  --name ca-spectree-dev \
  --resource-group $RESOURCE_GROUP \
  --min-replicas 1

# Increase resources
az containerapp update \
  --name ca-spectree-dev \
  --resource-group $RESOURCE_GROUP \
  --cpu 1.0 \
  --memory 2Gi
```

---

## Quick Reference Commands

### Deployment Commands

```bash
# Full deployment
cd infra && ./deploy.sh -e dev

# Validate only
./deploy.sh -e dev --validate

# What-if preview
./deploy.sh -e dev --what-if

# Build and push images
docker build -t $ACR.azurecr.io/spectree-api:latest -f packages/api/Dockerfile .
docker push $ACR.azurecr.io/spectree-api:latest

# Update Container App
az containerapp update -n ca-spectree-dev -g rg-spectree-dev --image $ACR.azurecr.io/spectree-api:latest
```

### Monitoring Commands

```bash
# View logs
az containerapp logs show -n ca-spectree-dev -g rg-spectree-dev --follow

# Check revisions
az containerapp revision list -n ca-spectree-dev -g rg-spectree-dev -o table

# Get app URL
az containerapp show -n ca-spectree-dev -g rg-spectree-dev --query properties.configuration.ingress.fqdn -o tsv
```

### Cleanup Commands

```bash
# Delete all resources (DANGER!)
az group delete --name rg-spectree-dev --yes --no-wait

# Delete specific Container App
az containerapp delete -n ca-spectree-dev -g rg-spectree-dev --yes
```

---

## Appendix: Environment-Specific Configuration

### Development Environment

```bash
# parameters/dev.bicepparam
environment = 'dev'
sqlEnableAadOnlyAuth = false
minReplicas = 0
maxReplicas = 3
```

### Staging Environment

```bash
# parameters/staging.bicepparam
environment = 'staging'
sqlEnableAadOnlyAuth = true
minReplicas = 1
maxReplicas = 5
```

### Production Environment

```bash
# parameters/prod.bicepparam
environment = 'prod'
sqlEnableAadOnlyAuth = true
minReplicas = 2
maxReplicas = 10
zoneRedundant = true
```

---

## Document Information

| Attribute | Value |
|-----------|-------|
| Version | 1.0.0 |
| Created | 2026-01-30 |
| Author | AI-generated analysis |
| Repository | SpecTree |
| Applicable Azure Regions | All regions supporting Container Apps |

---

## Related Documentation

- [README.md](/README.md) - Project overview and local development
- [infra/README.md](/infra/README.md) - Infrastructure documentation
- [docs/MCP/azure-deployment.md](/docs/MCP/azure-deployment.md) - MCP-specific Azure deployment
- [docs/database-safety-guide.md](/docs/database-safety-guide.md) - Database safety guidelines
