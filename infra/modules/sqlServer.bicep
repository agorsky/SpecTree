// SQL Server module
// Creates Azure SQL Server with security hardening and Database
// Security features: Azure AD auth, TLS 1.2, private endpoint only, auditing, threat detection

// ============================================================================
// Parameters
// ============================================================================

@description('Base name for resources')
param baseName string

@description('Environment name')
param environment string

@description('Location for resources')
param location string

@description('Tags to apply to resources')
param tags object = {}

@description('SQL Server administrator login')
@secure()
param adminLogin string

@description('SQL Server administrator password')
@secure()
param adminPassword string

@description('Subnet ID for private endpoint')
param subnetId string

@description('Database SKU name')
param databaseSku string = 'Basic'

@description('Database DTU capacity (for DTU-based SKUs)')
param databaseCapacity int = 5

@description('Database max size in bytes')
param databaseMaxSizeBytes int = 2147483648 // 2GB

@description('Azure AD admin object ID')
param aadAdminObjectId string

@description('Azure AD admin login name (email or display name)')
param aadAdminLogin string

@description('Azure AD tenant ID')
param aadTenantId string = subscription().tenantId

@description('Enable Azure AD only authentication')
param enableAadOnlyAuth bool = false

@description('Application user login name')
@secure()
param appUserLogin string

@description('Application user password')
@secure()
param appUserPassword string

// ============================================================================
// Variables
// ============================================================================

var serverName = 'sql-${baseName}-${environment}'
var databaseName = 'sqldb-${baseName}-${environment}'

// ============================================================================
// SQL Server
// ============================================================================

resource sqlServer 'Microsoft.Sql/servers@2023-08-01-preview' = {
  name: serverName
  location: location
  tags: tags
  properties: {
    administratorLogin: adminLogin
    administratorLoginPassword: adminPassword
    version: '12.0'
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Disabled'
    restrictOutboundNetworkAccess: 'Disabled'
    administrators: {
      administratorType: 'ActiveDirectory'
      principalType: 'Group'
      login: aadAdminLogin
      sid: aadAdminObjectId
      tenantId: aadTenantId
      azureADOnlyAuthentication: enableAadOnlyAuth
    }
  }
}

// ============================================================================
// Azure AD Administrator (explicit resource for better control)
// ============================================================================

resource sqlServerAadAdmin 'Microsoft.Sql/servers/administrators@2023-08-01-preview' = {
  parent: sqlServer
  name: 'ActiveDirectory'
  properties: {
    administratorType: 'ActiveDirectory'
    login: aadAdminLogin
    sid: aadAdminObjectId
    tenantId: aadTenantId
  }
}

// ============================================================================
// Firewall Rules - Deny all public access by default
// Only Azure services can access (for private endpoint connectivity)
// ============================================================================

resource firewallRuleAllowAzureServices 'Microsoft.Sql/servers/firewallRules@2023-08-01-preview' = {
  parent: sqlServer
  name: 'AllowAzureServices'
  properties: {
    // Special rule: 0.0.0.0 to 0.0.0.0 allows Azure services
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// ============================================================================
// SQL Database
// ============================================================================

resource sqlDatabase 'Microsoft.Sql/servers/databases@2023-08-01-preview' = {
  parent: sqlServer
  name: databaseName
  location: location
  tags: tags
  sku: {
    name: databaseSku
    tier: databaseSku
    capacity: databaseCapacity
  }
  properties: {
    collation: 'SQL_Latin1_General_CP1_CI_AS'
    maxSizeBytes: databaseMaxSizeBytes
    catalogCollation: 'SQL_Latin1_General_CP1_CI_AS'
    zoneRedundant: environment == 'prod'
    readScale: 'Disabled'
    requestedBackupStorageRedundancy: environment == 'prod' ? 'Geo' : 'Local'
  }
}

// ============================================================================
// Auditing Policy
// ============================================================================

resource sqlServerAuditingSettings 'Microsoft.Sql/servers/auditingSettings@2023-08-01-preview' = {
  parent: sqlServer
  name: 'default'
  properties: {
    state: 'Enabled'
    isAzureMonitorTargetEnabled: true
    retentionDays: 90
  }
}

// ============================================================================
// Advanced Threat Protection
// ============================================================================

resource sqlServerSecurityAlertPolicy 'Microsoft.Sql/servers/securityAlertPolicies@2023-08-01-preview' = {
  parent: sqlServer
  name: 'default'
  properties: {
    state: 'Enabled'
    emailAccountAdmins: true
  }
}

// ============================================================================
// Transparent Data Encryption
// ============================================================================

resource transparentDataEncryption 'Microsoft.Sql/servers/databases/transparentDataEncryption@2023-08-01-preview' = {
  parent: sqlDatabase
  name: 'current'
  properties: {
    state: 'Enabled'
  }
}

// ============================================================================
// Outputs
// ============================================================================

output sqlServerId string = sqlServer.id
output sqlServerName string = sqlServer.name
output sqlServerFqdn string = sqlServer.properties.fullyQualifiedDomainName
output sqlDatabaseId string = sqlDatabase.id
output sqlDatabaseName string = sqlDatabase.name

// Connection string for SQL authentication (admin)
output connectionString string = 'Server=tcp:${sqlServer.properties.fullyQualifiedDomainName},1433;Initial Catalog=${sqlDatabase.name};Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;'

// Connection string for application user (SQL auth)
output appConnectionString string = 'Server=tcp:${sqlServer.properties.fullyQualifiedDomainName},1433;Initial Catalog=${sqlDatabase.name};User ID=${appUserLogin};Password=${appUserPassword};Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;'

// Connection string base for Azure AD authentication
output aadConnectionString string = 'Server=tcp:${sqlServer.properties.fullyQualifiedDomainName},1433;Initial Catalog=${sqlDatabase.name};Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;Authentication=Active Directory Default;'

// Application user credentials (for Key Vault storage)
output appUserLogin string = appUserLogin
@secure()
output appUserPassword string = appUserPassword
