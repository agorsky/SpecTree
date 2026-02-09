// Container Apps module
// Creates Container Apps Environment (consumption plan) and Container App

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

@description('Subnet ID for Container Apps Environment')
param containerAppsSubnetId string

@description('Container image to deploy for API')
param containerImage string

@description('Container image to deploy for Web')
param webContainerImage string

@description('Key Vault URI for secrets')
param keyVaultUri string

@description('SQL connection string (will be stored securely)')
@secure()
param sqlConnectionString string

@description('Minimum number of replicas')
param minReplicas int = 0

@description('Maximum number of replicas')
param maxReplicas int = 10

// ============================================================================
// Variables
// ============================================================================

var envName = 'cae-${baseName}-${environment}'
var appName = 'ca-${baseName}-${environment}'
var webAppName = 'ca-${baseName}-web-${environment}'
var logAnalyticsName = 'log-${baseName}-${environment}'
var userAssignedIdentityName = 'id-${baseName}-${environment}'

// ============================================================================
// Log Analytics Workspace
// ============================================================================

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsName
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

// ============================================================================
// User Assigned Managed Identity
// ============================================================================

resource userAssignedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: userAssignedIdentityName
  location: location
  tags: tags
}

// ============================================================================
// Container Apps Environment
// ============================================================================

resource containerAppsEnvironment 'Microsoft.App/managedEnvironments@2023-11-02-preview' = {
  name: envName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
    vnetConfiguration: {
      infrastructureSubnetId: containerAppsSubnetId
      internal: false
    }
    zoneRedundant: environment == 'prod'
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
  }
}

// ============================================================================
// Container App
// ============================================================================

resource containerApp 'Microsoft.App/containerApps@2023-11-02-preview' = {
  name: appName
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${userAssignedIdentity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: containerAppsEnvironment.id
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 3001
        transport: 'http'
        allowInsecure: false
        traffic: [
          {
            latestRevision: true
            weight: 100
          }
        ]
      }
      secrets: [
        {
          name: 'sql-connection-string'
          value: sqlConnectionString
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'main'
          image: containerImage
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            {
              name: 'NODE_ENV'
              value: 'production'
            }
            {
              name: 'PORT'
              value: '3001'
            }
            {
              name: 'HOST'
              value: '0.0.0.0'
            }
            {
              name: 'SECRETS_PROVIDER'
              value: 'azure-keyvault'
            }
            {
              name: 'AZURE_KEYVAULT_URL'
              value: keyVaultUri
            }
            {
              name: 'AZURE_CLIENT_ID'
              value: userAssignedIdentity.properties.clientId
            }
            {
              name: 'SQLSERVER_DATABASE_URL'
              secretRef: 'sql-connection-string'
            }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/health'
                port: 3001
              }
              initialDelaySeconds: 10
              periodSeconds: 30
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/health'
                port: 3001
              }
              initialDelaySeconds: 5
              periodSeconds: 10
            }
          ]
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
        rules: [
          {
            name: 'http-rule'
            http: {
              metadata: {
                concurrentRequests: '100'
              }
            }
          }
        ]
      }
    }
  }
}

// ============================================================================
// Web Container App
// ============================================================================

resource webContainerApp 'Microsoft.App/containerApps@2023-11-02-preview' = {
  name: webAppName
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${userAssignedIdentity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: containerAppsEnvironment.id
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 80
        transport: 'http'
        allowInsecure: false
        traffic: [
          {
            latestRevision: true
            weight: 100
          }
        ]
      }
    }
    template: {
      containers: [
        {
          name: 'web'
          image: webContainerImage
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
        rules: [
          {
            name: 'http-rule'
            http: {
              metadata: {
                concurrentRequests: '100'
              }
            }
          }
        ]
      }
    }
  }
}

// ============================================================================
// Outputs
// ============================================================================

output containerAppsEnvironmentId string = containerAppsEnvironment.id
output containerAppsEnvironmentName string = containerAppsEnvironment.name
output containerAppId string = containerApp.id
output containerAppName string = containerApp.name
output containerAppFqdn string = containerApp.properties.configuration.ingress.fqdn
output webContainerAppId string = webContainerApp.id
output webContainerAppName string = webContainerApp.name
output webContainerAppFqdn string = webContainerApp.properties.configuration.ingress.fqdn
output managedIdentityId string = userAssignedIdentity.id
output managedIdentityClientId string = userAssignedIdentity.properties.clientId
output managedIdentityPrincipalId string = userAssignedIdentity.properties.principalId
