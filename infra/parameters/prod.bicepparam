using '../main.bicep'

// ============================================================================
// Production Environment Parameters
// ============================================================================

param environment = 'prod'
param location = 'eastus'
param baseName = 'spectree'

// SQL credentials - these should be provided at deployment time via CLI
// DO NOT commit actual credentials to source control
param sqlAdminLogin = '' // Provide via --parameters at deployment
param sqlAdminPassword = '' // Provide via --parameters at deployment

// Azure AD admin for SQL Server - provide at deployment time
param sqlAadAdminObjectId = '' // Azure AD group or user object ID
param sqlAadAdminLogin = '' // Azure AD group or user display name/email
param sqlEnableAadOnlyAuth = true // Production should use Azure AD only

// SQL application user credentials - provide at deployment time
param sqlAppUserLogin = '' // Application user login name
param sqlAppUserPassword = '' // Application user password

// Container configuration - should be updated with actual production image
param containerImage = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

// Front Door configuration
param frontDoorEnabled = false // Set to true to deploy Azure Front Door with WAF

// Resource tags
param tags = {
  environment: 'prod'
  project: 'spectree'
  costCenter: 'production'
  owner: 'platform-team'
  criticality: 'high'
}
