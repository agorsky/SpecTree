// Private Endpoints module
// Creates private endpoints for SQL Server and Key Vault

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

@description('Virtual Network ID')
param vnetId string

@description('Subnet ID for private endpoints')
param subnetId string

@description('SQL Server resource ID')
param sqlServerId string

@description('Key Vault resource ID')
param keyVaultId string

// ============================================================================
// Variables
// ============================================================================

var sqlPrivateEndpointName = 'pe-sql-${baseName}-${environment}'
var kvPrivateEndpointName = 'pe-kv-${baseName}-${environment}'
var sqlPrivateDnsZoneName = 'privatelink${az.environment().suffixes.sqlServerHostname}'
var kvPrivateDnsZoneName = 'privatelink.vaultcore.azure.net'

// ============================================================================
// Private DNS Zones
// ============================================================================

resource sqlPrivateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: sqlPrivateDnsZoneName
  location: 'global'
  tags: tags
  properties: {}
}

resource kvPrivateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: kvPrivateDnsZoneName
  location: 'global'
  tags: tags
  properties: {}
}

// ============================================================================
// VNet Links for Private DNS Zones
// ============================================================================

resource sqlPrivateDnsZoneVnetLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: sqlPrivateDnsZone
  name: 'link-sql-${baseName}-${environment}'
  location: 'global'
  tags: tags
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: vnetId
    }
  }
}

resource kvPrivateDnsZoneVnetLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: kvPrivateDnsZone
  name: 'link-kv-${baseName}-${environment}'
  location: 'global'
  tags: tags
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: vnetId
    }
  }
}

// ============================================================================
// SQL Server Private Endpoint
// ============================================================================

resource sqlPrivateEndpoint 'Microsoft.Network/privateEndpoints@2023-09-01' = {
  name: sqlPrivateEndpointName
  location: location
  tags: tags
  properties: {
    subnet: {
      id: subnetId
    }
    privateLinkServiceConnections: [
      {
        name: sqlPrivateEndpointName
        properties: {
          privateLinkServiceId: sqlServerId
          groupIds: ['sqlServer']
        }
      }
    ]
  }
}

resource sqlPrivateDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-09-01' = {
  parent: sqlPrivateEndpoint
  name: 'sqlPrivateDnsZoneGroup'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'config'
        properties: {
          privateDnsZoneId: sqlPrivateDnsZone.id
        }
      }
    ]
  }
}

// ============================================================================
// Key Vault Private Endpoint
// ============================================================================

resource kvPrivateEndpoint 'Microsoft.Network/privateEndpoints@2023-09-01' = {
  name: kvPrivateEndpointName
  location: location
  tags: tags
  properties: {
    subnet: {
      id: subnetId
    }
    privateLinkServiceConnections: [
      {
        name: kvPrivateEndpointName
        properties: {
          privateLinkServiceId: keyVaultId
          groupIds: ['vault']
        }
      }
    ]
  }
}

resource kvPrivateDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-09-01' = {
  parent: kvPrivateEndpoint
  name: 'kvPrivateDnsZoneGroup'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'config'
        properties: {
          privateDnsZoneId: kvPrivateDnsZone.id
        }
      }
    ]
  }
}

// ============================================================================
// Outputs
// ============================================================================

output sqlPrivateEndpointId string = sqlPrivateEndpoint.id
output sqlPrivateEndpointName string = sqlPrivateEndpoint.name
output sqlPrivateDnsZoneId string = sqlPrivateDnsZone.id
output kvPrivateEndpointId string = kvPrivateEndpoint.id
output kvPrivateEndpointName string = kvPrivateEndpoint.name
output kvPrivateDnsZoneId string = kvPrivateDnsZone.id
