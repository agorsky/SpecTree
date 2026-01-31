// Key Vault module
// Creates Key Vault with firewall enabled and private endpoint support

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

@description('Subnet ID for private endpoint')
param subnetId string

@description('Enable soft delete')
param enableSoftDelete bool = true

@description('Soft delete retention in days')
param softDeleteRetentionInDays int = 90

@description('Enable purge protection')
param enablePurgeProtection bool = true

@description('SQL connection string for application user')
@secure()
param sqlConnectionString string = ''

@description('SQL application user login')
@secure()
param sqlAppUserLogin string = ''

@description('SQL application user password')
@secure()
param sqlAppUserPassword string = ''

@description('SQL Server fully qualified domain name')
param sqlServerFqdn string = ''

@description('SQL Database name')
param sqlDatabaseName string = ''

// ============================================================================
// Variables
// ============================================================================

var keyVaultName = 'kv-${baseName}-${environment}'

// ============================================================================
// Key Vault
// ============================================================================

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  tags: tags
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: enableSoftDelete
    softDeleteRetentionInDays: softDeleteRetentionInDays
    enablePurgeProtection: enablePurgeProtection ? true : null
    publicNetworkAccess: 'Disabled'
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Deny'
      ipRules: []
      virtualNetworkRules: []
    }
  }
}

// ============================================================================
// Diagnostic Settings
// Note: Disabled until Log Analytics workspace is created and passed as parameter
// ============================================================================

// resource keyVaultDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
//   name: 'diag-${keyVaultName}'
//   scope: keyVault
//   properties: {
//     workspaceId: '<LOG_ANALYTICS_WORKSPACE_ID>'  // Required: Log Analytics workspace
//     logs: [
//       {
//         categoryGroup: 'allLogs'
//         enabled: true
//       }
//     ]
//     metrics: [
//       {
//         category: 'AllMetrics'
//         enabled: true
//       }
//     ]
//   }
// }

// ============================================================================
// SQL Secrets
// ============================================================================

resource sqlConnectionStringSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(sqlConnectionString)) {
  parent: keyVault
  name: 'sql-connection-string'
  properties: {
    value: sqlConnectionString
    contentType: 'text/plain'
    attributes: {
      enabled: true
    }
  }
}

resource sqlAppUserLoginSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(sqlAppUserLogin)) {
  parent: keyVault
  name: 'sql-app-user-login'
  properties: {
    value: sqlAppUserLogin
    contentType: 'text/plain'
    attributes: {
      enabled: true
    }
  }
}

resource sqlAppUserPasswordSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(sqlAppUserPassword)) {
  parent: keyVault
  name: 'sql-app-user-password'
  properties: {
    value: sqlAppUserPassword
    contentType: 'text/plain'
    attributes: {
      enabled: true
    }
  }
}

resource sqlServerFqdnSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(sqlServerFqdn)) {
  parent: keyVault
  name: 'sql-server-fqdn'
  properties: {
    value: sqlServerFqdn
    contentType: 'text/plain'
    attributes: {
      enabled: true
    }
  }
}

resource sqlDatabaseNameSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(sqlDatabaseName)) {
  parent: keyVault
  name: 'sql-database-name'
  properties: {
    value: sqlDatabaseName
    contentType: 'text/plain'
    attributes: {
      enabled: true
    }
  }
}

// ============================================================================
// Outputs
// ============================================================================

output keyVaultId string = keyVault.id
output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri
output sqlConnectionStringSecretUri string = !empty(sqlConnectionString) ? sqlConnectionStringSecret.properties.secretUri : ''
