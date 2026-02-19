using '../main.bicep'

// ============================================================================
// Development Environment Parameters
// ============================================================================

param environment = 'dev'
param location = 'eastus'
param baseName = 'spectree'

// SQL credentials - these should be provided at deployment time via CLI
// DO NOT commit actual credentials to source control
param sqlAdminLogin = '' // Provide via --parameters at deployment
param sqlAdminPassword = '' // Provide via --parameters at deployment

// Azure AD admin for SQL Server - provide at deployment time
param sqlAadAdminObjectId = '' // Azure AD group or user object ID
param sqlAadAdminLogin = '' // Azure AD group or user display name/email
param sqlEnableAadOnlyAuth = false // Set to true to disable SQL auth

// SQL application user credentials - provide at deployment time
param sqlAppUserLogin = '' // Application user login name
param sqlAppUserPassword = '' // Application user password

// Container configuration
param containerImage = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

// Front Door configuration
param frontDoorEnabled = true // Front Door + WAF enabled for dev

// Resource tags
param tags = {
  environment: 'dev'
  project: 'spectree'
  costCenter: 'development'
  owner: 'platform-team'
}
