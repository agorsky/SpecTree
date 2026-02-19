// Main orchestration file for Azure infrastructure
// Deploys all resources for the SpecTree application

targetScope = 'subscription'

// ============================================================================
// Parameters
// ============================================================================

@description('Environment name (dev, staging, prod)')
@allowed(['dev', 'staging', 'prod'])
param environment string

@description('Azure region for all resources')
param location string

@description('Base name for all resources')
param baseName string

@description('SQL Server administrator login')
@secure()
param sqlAdminLogin string

@description('SQL Server administrator password')
@secure()
param sqlAdminPassword string

@description('Azure AD admin object ID for SQL Server')
param sqlAadAdminObjectId string

@description('Azure AD admin login name for SQL Server')
param sqlAadAdminLogin string

@description('SQL application user login')
@secure()
param sqlAppUserLogin string

@description('SQL application user password')
@secure()
param sqlAppUserPassword string

@description('Enable Azure AD only authentication for SQL')
param sqlEnableAadOnlyAuth bool = false

@description('Container image to deploy')
param containerImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

@description('Enable Azure Front Door with WAF')
param frontDoorEnabled bool = false

@description('Tags to apply to all resources')
param tags object = {}

// ============================================================================
// Variables
// ============================================================================

var resourceGroupName = 'rg-${baseName}-${environment}'
var defaultTags = union(tags, {
  environment: environment
  managedBy: 'bicep'
  project: baseName
})

// ============================================================================
// Resource Group
// ============================================================================

module rg 'modules/resourceGroup.bicep' = {
  name: 'deploy-resource-group'
  params: {
    name: resourceGroupName
    location: location
    tags: defaultTags
  }
}

// ============================================================================
// Virtual Network
// ============================================================================

module vnet 'modules/vnet.bicep' = {
  name: 'deploy-vnet'
  scope: resourceGroup(resourceGroupName)
  params: {
    baseName: baseName
    environment: environment
    location: location
    tags: defaultTags
  }
  dependsOn: [rg]
}

// ============================================================================
// Key Vault
// ============================================================================

module keyVault 'modules/keyVault.bicep' = {
  name: 'deploy-keyvault'
  scope: resourceGroup(resourceGroupName)
  params: {
    baseName: baseName
    environment: environment
    location: location
    tags: defaultTags
    subnetId: vnet.outputs.privateEndpointSubnetId
    sqlConnectionString: sql.outputs.appConnectionString
    sqlAppUserLogin: sql.outputs.appUserLogin
    sqlAppUserPassword: sql.outputs.appUserPassword
    sqlServerFqdn: sql.outputs.sqlServerFqdn
    sqlDatabaseName: sql.outputs.sqlDatabaseName
  }
  dependsOn: [vnet, sql]
}

// ============================================================================
// SQL Server and Database
// ============================================================================

module sql 'modules/sqlServer.bicep' = {
  name: 'deploy-sql'
  scope: resourceGroup(resourceGroupName)
  params: {
    baseName: baseName
    environment: environment
    location: location
    tags: defaultTags
    adminLogin: sqlAdminLogin
    adminPassword: sqlAdminPassword
    subnetId: vnet.outputs.privateEndpointSubnetId
    aadAdminObjectId: sqlAadAdminObjectId
    aadAdminLogin: sqlAadAdminLogin
    enableAadOnlyAuth: sqlEnableAadOnlyAuth
    appUserLogin: sqlAppUserLogin
    appUserPassword: sqlAppUserPassword
  }
  dependsOn: [vnet]
}

// ============================================================================
// Private Endpoints
// ============================================================================

module privateEndpoints 'modules/privateEndpoints.bicep' = {
  name: 'deploy-private-endpoints'
  scope: resourceGroup(resourceGroupName)
  params: {
    baseName: baseName
    environment: environment
    location: location
    tags: defaultTags
    vnetId: vnet.outputs.vnetId
    subnetId: vnet.outputs.privateEndpointSubnetId
    sqlServerId: sql.outputs.sqlServerId
    keyVaultId: keyVault.outputs.keyVaultId
  }
  dependsOn: [keyVault]
}

// ============================================================================
// Container Apps Environment and App
// ============================================================================

module containerApps 'modules/containerApps.bicep' = {
  name: 'deploy-container-apps'
  scope: resourceGroup(resourceGroupName)
  params: {
    baseName: baseName
    environment: environment
    location: location
    tags: defaultTags
    containerAppsSubnetId: vnet.outputs.containerAppsSubnetId
    containerImage: containerImage
    keyVaultUri: keyVault.outputs.keyVaultUri
    sqlConnectionString: sql.outputs.connectionString
    azureFrontDoorId: frontDoorEnabled ? frontDoor.outputs.frontDoorId : ''
  }
  dependsOn: [privateEndpoints]
}

// ============================================================================
// Azure Front Door with WAF
// ============================================================================

module frontDoor 'modules/frontDoor.bicep' = {
  name: 'deploy-front-door'
  scope: resourceGroup(resourceGroupName)
  params: {
    baseName: baseName
    environment: environment
    tags: defaultTags
    containerAppFqdn: containerApps.outputs.containerAppFqdn
    webContainerAppFqdn: containerApps.outputs.webContainerAppFqdn
    enabled: frontDoorEnabled
  }
  dependsOn: [containerApps]
}

// ============================================================================
// Outputs
// ============================================================================

output resourceGroupName string = resourceGroupName
output containerAppFqdn string = containerApps.outputs.containerAppFqdn
output webContainerAppFqdn string = containerApps.outputs.webContainerAppFqdn
output keyVaultName string = keyVault.outputs.keyVaultName
output sqlServerName string = sql.outputs.sqlServerName
output sqlDatabaseName string = sql.outputs.sqlDatabaseName
output frontDoorEndpointFqdn string = frontDoorEnabled ? frontDoor.outputs.endpointFqdn : ''
output frontDoorId string = frontDoorEnabled ? frontDoor.outputs.frontDoorId : ''
