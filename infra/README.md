# SpecTree Infrastructure

Azure infrastructure for the SpecTree application using Bicep.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Azure Subscription                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   Resource Group                          │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │                 Virtual Network                      │  │  │
│  │  │   ┌────────────────┐    ┌────────────────────────┐  │  │  │
│  │  │   │ Container Apps │    │  Private Endpoints     │  │  │  │
│  │  │   │    Subnet      │    │       Subnet           │  │  │  │
│  │  │   └────────────────┘    └────────────────────────┘  │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │  │
│  │  │ Container    │  │  SQL Server  │  │  Key Vault   │    │  │
│  │  │    Apps      │  │  (Private)   │  │  (Private)   │    │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘    │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Security Features

### SQL Server Security
- **Azure AD Authentication**: Primary authentication method with optional Azure AD-only mode
- **TLS 1.2 Minimum**: All connections require TLS 1.2 or higher
- **Private Endpoint Only**: Public network access disabled by default
- **Auditing Enabled**: 90-day audit log retention to Azure Monitor
- **Threat Detection**: Advanced Threat Protection with email alerts
- **Transparent Data Encryption**: Enabled by default

### Key Vault Security
- **RBAC Authorization**: Uses Azure RBAC for access control
- **Private Endpoint**: No public access
- **Soft Delete**: 90-day retention for deleted secrets
- **Purge Protection**: Enabled to prevent accidental deletion

## Deployment

### Prerequisites
- Azure CLI installed and authenticated (`az login`)
- Bicep CLI installed (`az bicep install`)
- Appropriate Azure permissions

### Deploy to Development
```bash
# Set required parameters
export SQL_ADMIN_LOGIN="sqladmin"
export SQL_ADMIN_PASSWORD="<secure-password>"
export SQL_AAD_ADMIN_OBJECT_ID="<azure-ad-group-object-id>"
export SQL_AAD_ADMIN_LOGIN="<azure-ad-group-name>"
export SQL_APP_USER_LOGIN="spectree_app"
export SQL_APP_USER_PASSWORD="<secure-password>"

# Deploy
./deploy.sh dev
```

### Deploy to Production
```bash
# Production uses Azure AD-only authentication
./deploy.sh prod
```

## Database Connection

### Application Connection (Recommended)

The application should retrieve connection credentials from Key Vault:

**Secrets stored in Key Vault:**
| Secret Name | Description |
|------------|-------------|
| `sql-connection-string` | Full connection string with app user credentials |
| `sql-app-user-login` | Application user login name |
| `sql-app-user-password` | Application user password |
| `sql-server-fqdn` | SQL Server fully qualified domain name |
| `sql-database-name` | Database name |

**Using Managed Identity (Preferred):**
```csharp
// .NET example using Azure.Identity
var credential = new DefaultAzureCredential();
var client = new SecretClient(new Uri(keyVaultUri), credential);
var connectionString = await client.GetSecretAsync("sql-connection-string");
```

### Local Development Connection

Since the database is private endpoint only, local development requires one of:

#### Option 1: Temporary Firewall Rule (Quick Testing)

⚠️ **Note**: This temporarily exposes the SQL Server to public internet.

```bash
# Add your IP to firewall
./scripts/add-dev-firewall.sh add

# Connect using your preferred tool (Azure Data Studio, SSMS, etc.)
# Server: sql-spectree-dev.database.windows.net
# Authentication: Azure Active Directory - Universal with MFA

# When done, remove the rule
./scripts/add-dev-firewall.sh remove
```

#### Option 2: Azure Bastion / Jump Box (Recommended for Prod-like testing)

1. Deploy an Azure Bastion or jump box VM in the VNet
2. Connect to the VM
3. Access SQL Server via private endpoint from within the VNet

#### Option 3: VPN Gateway

1. Set up Azure VPN Gateway
2. Configure point-to-site VPN
3. Connect to VPN
4. Access SQL Server via private IP

### Connection Strings

**SQL Authentication (Application User):**
```
Server=tcp:<server>.database.windows.net,1433;Initial Catalog=<database>;User ID=<app-user>;Password=<password>;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;
```

**Azure AD Authentication (Managed Identity):**
```
Server=tcp:<server>.database.windows.net,1433;Initial Catalog=<database>;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;Authentication=Active Directory Default;
```

**Azure AD Authentication (Interactive):**
```
Server=tcp:<server>.database.windows.net,1433;Initial Catalog=<database>;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;Authentication=Active Directory Interactive;
```

## Post-Deployment Setup

### 1. Create Application Database User

After initial deployment, run the SQL setup script to create the application user:

```bash
# Connect to the database using Azure AD admin credentials
# Then execute the setup script with variable substitution:

sqlcmd -S sql-spectree-dev.database.windows.net \
       -d sqldb-spectree-dev \
       -G \
       -v APP_USER_LOGIN="spectree_app" \
       -v APP_USER_PASSWORD="<secure-password>" \
       -v DATABASE_NAME="sqldb-spectree-dev" \
       -i scripts/setup-sql-user.sql
```

Or use Azure Data Studio:
1. Connect with Azure AD authentication
2. Open `scripts/setup-sql-user.sql`
3. Replace placeholder variables
4. Execute

### 2. Grant Container App Access to Key Vault

```bash
# Get Container App managed identity
IDENTITY=$(az containerapp show -n ca-spectree-dev -g rg-spectree-dev \
           --query identity.principalId -o tsv)

# Grant Key Vault Secrets User role
az role assignment create \
    --role "Key Vault Secrets User" \
    --assignee $IDENTITY \
    --scope /subscriptions/<sub-id>/resourceGroups/rg-spectree-dev/providers/Microsoft.KeyVault/vaults/kv-spectree-dev
```

## Scripts

| Script | Description |
|--------|-------------|
| `deploy.sh` | Main deployment script |
| `scripts/add-dev-firewall.sh` | Add/remove developer IP from SQL firewall |
| `scripts/setup-sql-user.sql` | Create application database user |

## Troubleshooting

### Cannot connect to SQL Server
1. Verify private endpoint is configured: `az sql server show -n sql-spectree-dev -g rg-spectree-dev --query publicNetworkAccess`
2. For local dev, ensure firewall rule is added: `./scripts/add-dev-firewall.sh status`
3. Check Azure AD authentication: `az account show`

### Key Vault access denied
1. Verify RBAC permissions: `az role assignment list --scope <key-vault-resource-id>`
2. Check network access: Key Vault is private endpoint only

### Container App cannot reach SQL
1. Verify private DNS zone is linked to VNet
2. Check Container App is in the correct subnet
3. Verify managed identity has correct permissions
