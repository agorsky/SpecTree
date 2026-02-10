# Secrets Provider Configuration

SpecTree supports pluggable secrets providers for secure secret management.

## Available Providers

### 1. Environment Variables (default)

Reads secrets from environment variables. This is the default when no provider is configured.

```bash
# No additional configuration needed
JWT_SECRET=your-secret-here
```

### 2. Azure Key Vault

Reads secrets from Azure Key Vault using DefaultAzureCredential.

```bash
# Required environment variables
SECRETS_PROVIDER=azure-keyvault
AZURE_KEYVAULT_URL=https://your-keyvault-name.vault.azure.net
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SECRETS_PROVIDER` | Provider to use: `env` or `azure-keyvault` | `env` |
| `AZURE_KEYVAULT_URL` | Key Vault URL (required for azure-keyvault) | - |

### Secret Name Mapping

When using Azure Key Vault, secret names are automatically mapped:

| Application Name | Environment Variable | Key Vault Name |
|-----------------|---------------------|----------------|
| `JWT_SECRET` | `JWT_SECRET` | `JWT-SECRET` |
| `DATABASE_URL` | `DATABASE_URL` | `DATABASE-URL` |

> Note: Key Vault uses hyphens instead of underscores in secret names.

## Azure Key Vault Setup

### 1. Create a Key Vault

```bash
# Using Azure CLI
az keyvault create \
  --name kv-spectree-dev \
  --resource-group your-resource-group \
  --location eastus \
  --sku standard
```

Or use the Azure Portal:
1. Go to "Create a resource" → "Key Vault"
2. Select your subscription and resource group
3. Enter a globally unique name
4. Select "Azure role-based access control" for permission model

### 2. Grant Access

For **local development** (using your Azure CLI credentials):
```bash
# Grant yourself Key Vault Secrets Officer role
az role assignment create \
  --role "Key Vault Secrets Officer" \
  --assignee your-email@domain.com \
  --scope /subscriptions/{sub-id}/resourceGroups/{rg}/providers/Microsoft.KeyVault/vaults/{vault-name}
```

For **production** (using Managed Identity):
```bash
# Grant the app's managed identity Key Vault Secrets User role
az role assignment create \
  --role "Key Vault Secrets User" \
  --assignee {managed-identity-principal-id} \
  --scope /subscriptions/{sub-id}/resourceGroups/{rg}/providers/Microsoft.KeyVault/vaults/{vault-name}
```

### 3. Add Secrets

```bash
# Add JWT secret
az keyvault secret set \
  --vault-name kv-spectree-dev \
  --name JWT-SECRET \
  --value "your-secure-jwt-secret"
```

Or via Azure Portal:
1. Go to your Key Vault → Secrets
2. Click "+ Generate/Import"
3. Enter name (using hyphens) and value

### 4. Authenticate Locally

```bash
# Login to Azure CLI
az login
az account set --subscription "Your Subscription Name"
```

The `DefaultAzureCredential` will automatically use your CLI credentials.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Application                          │
├─────────────────────────────────────────────────────────┤
│  getSecret("JWT_SECRET")                                │
│         │                                                │
│         ▼                                                │
│  ┌─────────────────────┐                                │
│  │  SecretsProvider    │ (interface)                    │
│  └─────────────────────┘                                │
│         │                                                │
│    ┌────┴────┐                                          │
│    ▼         ▼                                          │
│ ┌──────┐  ┌──────────────┐                              │
│ │ Env  │  │ Azure KeyVault│                             │
│ └──────┘  └──────────────┘                              │
│    │              │                                      │
│    ▼              ▼                                      │
│ process.env   SecretClient                              │
└─────────────────────────────────────────────────────────┘
```

## Files

- `src/lib/secrets/types.ts` - Interfaces and secret name mappings
- `src/lib/secrets/env-provider.ts` - Environment variable provider
- `src/lib/secrets/azure-keyvault-provider.ts` - Azure Key Vault provider
- `src/lib/secrets/index.ts` - Factory and exports

## Usage in Code

```typescript
import { getSecret, getSecretOptional } from "./lib/secrets/index.js";

// Get required secret (throws if not found)
const jwtSecret = await getSecret("JWT_SECRET");

// Get optional secret (returns undefined if not found)
const apiKey = await getSecretOptional("API_KEY");
```

## Testing

The provider defaults to environment variables, so existing tests continue to work without changes. For integration testing with Key Vault:

```bash
SECRETS_PROVIDER=azure-keyvault \
AZURE_KEYVAULT_URL=https://kv-spectree-dev.vault.azure.net \
npm run dev
```
