# Bicep Secret Reference Pattern for Container Apps

## Overview

This document describes the secure pattern implemented in `infra/modules/containerApps.bicep` for storing and referencing the SQL Server connection string in Azure Container Apps.

## Pattern Components

### 1. Secure Parameter Declaration

```bicep
@description('SQL connection string (will be stored securely)')
@secure()
param sqlConnectionString string
```

**Key Features:**
- `@secure()` decorator prevents the parameter value from being logged or displayed in deployment history
- Marks the parameter as sensitive in ARM/Bicep processing
- Must be provided at deployment time (not stored in source control)

### 2. Secret Definition

```bicep
configuration: {
  secrets: [
    {
      name: 'sql-connection-string'
      value: sqlConnectionString
    }
  ]
}
```

**Key Features:**
- Secret is stored encrypted at rest in Container App
- Secret is NOT visible in Azure Portal UI
- Secret value is referenced from the secure parameter
- Secret name is used for referencing in environment variables

### 3. Environment Variable with Secret Reference

```bicep
env: [
  {
    name: 'SQLSERVER_DATABASE_URL'
    secretRef: 'sql-connection-string'
  }
]
```

**Key Features:**
- `secretRef` property links environment variable to the secret
- Environment variable receives the secret value at runtime
- No plaintext password in environment variable definition
- Compatible with application code expecting standard env vars

## Security Benefits

| Before (Plaintext) | After (Secret Reference) |
|-------------------|-------------------------|
| ❌ Password visible in Portal | ✅ Password hidden from Portal UI |
| ❌ Logged in deployment history | ✅ Not logged (via `@secure()`) |
| ❌ Stored in plaintext | ✅ Encrypted at rest |
| ❌ Visible to anyone with read access | ✅ Only accessible to container at runtime |

## Deployment Example

### Using Azure CLI

```bash
# Set connection string as parameter
SQL_CONN="sqlserver://sql-spectree-dev.database.windows.net:1433;database=sqldb-spectree-dev;user=sqladmin;password=YourSecurePassword123!;encrypt=true"

# Deploy with secure parameter
az deployment group create \
  --resource-group rg-spectree-dev \
  --template-file infra/modules/containerApps.bicep \
  --parameters baseName=spectree \
  --parameters environment=dev \
  --parameters sqlConnectionString="$SQL_CONN" \
  --parameters containerImage=myregistry.azurecr.io/spectree-api:latest \
  --parameters keyVaultUri=https://kv-spectree-dev.vault.azure.net \
  --parameters containerAppsSubnetId=/subscriptions/.../subnets/...
```

**Important:** Never commit `$SQL_CONN` to source control!

### Using Bicep Parameters File (Encrypted)

```jsonc
// parameters.dev.json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "sqlConnectionString": {
      "reference": {
        "keyVault": {
          "id": "/subscriptions/.../resourceGroups/.../providers/Microsoft.KeyVault/vaults/kv-deployment-secrets"
        },
        "secretName": "sql-connection-string-dev"
      }
    }
  }
}
```

**Note:** This approach stores the connection string in a Key Vault used only for deployment secrets, not runtime secrets.

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Deployment Time                                          │
│    ┌──────────────┐                                         │
│    │ Bicep File   │ @secure() param sqlConnectionString     │
│    └──────┬───────┘                                         │
│           │                                                  │
│           ▼                                                  │
│    ┌──────────────┐                                         │
│    │ Azure ARM    │ Receives secure parameter (not logged) │
│    └──────┬───────┘                                         │
│           │                                                  │
│           ▼                                                  │
│    ┌──────────────────────────────┐                        │
│    │ Container App Secret Store   │ Encrypted at rest      │
│    │ Name: sql-connection-string  │                        │
│    │ Value: sqlserver://...       │                        │
│    └──────────────────────────────┘                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 2. Runtime                                                   │
│    ┌────────────────────────┐                               │
│    │ Container App Revision │                               │
│    │                        │                               │
│    │ env:                   │                               │
│    │   SQLSERVER_DATABASE_URL ──> secretRef ──┐            │
│    │                        │                  │            │
│    └────────────────────────┘                  │            │
│                                                 ▼            │
│                          ┌──────────────────────────────┐   │
│                          │ Secret Store Lookup          │   │
│                          │ Returns decrypted value      │   │
│                          └──────────────────────────────┘   │
│                                                 │            │
│                                                 ▼            │
│    ┌────────────────────────────────────────────────────┐   │
│    │ Application Process                                │   │
│    │ process.env.SQLSERVER_DATABASE_URL                 │   │
│    │ = "sqlserver://sql-...;password=...;encrypt=true" │   │
│    └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Compatibility

### Prisma Schema

The environment variable name `SQLSERVER_DATABASE_URL` is specifically chosen to match the Prisma datasource configuration:

```prisma
datasource db {
  provider = "sqlserver"
  url      = env("SQLSERVER_DATABASE_URL")
}
```

No code changes required!

### Local Development

For local development, developers continue using `.env` files:

```env
# .env.local (NOT committed to source control)
SQLSERVER_DATABASE_URL=sqlserver://localhost:1433;database=spectree;user=sa;password=LocalDev123!;encrypt=false
```

## Secret Rotation

To rotate the SQL password:

1. Update SQL Server password in Azure Portal
2. Update the connection string parameter value
3. Redeploy the Bicep template

```bash
# Update connection string with new password
NEW_SQL_CONN="sqlserver://...:1433;...password=NewPassword456!;..."

az deployment group create \
  --resource-group rg-spectree-dev \
  --template-file infra/modules/containerApps.bicep \
  --parameters sqlConnectionString="$NEW_SQL_CONN" \
  # ... other parameters
```

The Container App will create a new revision with the updated secret.

## Troubleshooting

### Container can't connect to SQL Server

**Check 1:** Verify secret is set correctly
```bash
az containerapp show --name ca-spectree-dev --resource-group rg-spectree-dev --query "properties.configuration.secrets[?name=='sql-connection-string'].name"
```

**Check 2:** Verify environment variable uses secretRef
```bash
az containerapp show --name ca-spectree-dev --resource-group rg-spectree-dev --query "properties.template.containers[0].env[?name=='SQLSERVER_DATABASE_URL']"
```

Expected output:
```json
[
  {
    "name": "SQLSERVER_DATABASE_URL",
    "secretRef": "sql-connection-string"
  }
]
```

**Check 3:** View logs for connection errors
```bash
az containerapp logs show --name ca-spectree-dev --resource-group rg-spectree-dev --follow
```

### Secret value appears in logs

If you see the connection string in deployment logs, verify:
1. ✅ Parameter has `@secure()` decorator
2. ✅ Not passing secret via `--parameters` flag with `=` (use separate `--parameters` for each)
3. ✅ Not echoing the value in deployment scripts

## Best Practices

1. ✅ **Always use `@secure()` for sensitive parameters**
2. ✅ **Never commit connection strings to source control**
3. ✅ **Use different credentials for each environment**
4. ✅ **Rotate passwords regularly (quarterly minimum)**
5. ✅ **Use strong passwords (20+ characters, mixed case, symbols)**
6. ✅ **Enable SQL Server audit logging**
7. ✅ **Restrict SQL user to minimum required permissions**
8. ✅ **Use Azure Key Vault for deployment secrets** (parameters file reference)
9. ✅ **Test secret rotation process in dev environment first**
10. ✅ **Monitor Container App logs for authentication failures**

## Related Documentation

- [Azure Container Apps Secrets](https://learn.microsoft.com/en-us/azure/container-apps/manage-secrets)
- [Bicep Secure Parameters](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/parameters#secure-parameters)
- [Secure Database Connection Evaluation](./secure-database-connection-evaluation.md)
