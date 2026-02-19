// Virtual Network module
// Creates VNet with subnets for Container Apps and Private Endpoints

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

@description('Address prefix for the VNet')
param vnetAddressPrefix string = '10.0.0.0/16'

@description('Address prefix for Container Apps subnet')
param containerAppsSubnetPrefix string = '10.0.0.0/23'

@description('Address prefix for Private Endpoints subnet')
param privateEndpointSubnetPrefix string = '10.0.2.0/24'

// ============================================================================
// Variables
// ============================================================================

var vnetName = 'vnet-${baseName}-${environment}'
var containerAppsSubnetName = 'snet-container-apps'
var privateEndpointSubnetName = 'snet-private-endpoints'

// ============================================================================
// Network Security Groups
// ============================================================================

resource containerAppsNsg 'Microsoft.Network/networkSecurityGroups@2023-09-01' = {
  name: 'nsg-${containerAppsSubnetName}-${environment}'
  location: location
  tags: tags
  properties: {
    securityRules: [
      {
        name: 'AllowHTTPSInbound'
        properties: {
          priority: 100
          direction: 'Inbound'
          access: 'Allow'
          protocol: 'Tcp'
          sourcePortRange: '*'
          destinationPortRange: '443'
          sourceAddressPrefix: '*' // Phase 4 lockdown will restrict to AzureFrontDoor.Backend
          destinationAddressPrefix: '*'
        }
      }
      {
        name: 'AllowHTTPInbound'
        properties: {
          priority: 110
          direction: 'Inbound'
          access: 'Allow'
          protocol: 'Tcp'
          sourcePortRange: '*'
          destinationPortRange: '80'
          sourceAddressPrefix: '*' // Phase 4 lockdown will restrict to AzureFrontDoor.Backend
          destinationAddressPrefix: '*'
        }
      }
    ]
  }
}

resource privateEndpointNsg 'Microsoft.Network/networkSecurityGroups@2023-09-01' = {
  name: 'nsg-${privateEndpointSubnetName}-${environment}'
  location: location
  tags: tags
  properties: {
    securityRules: []
  }
}

// ============================================================================
// Virtual Network
// ============================================================================

resource vnet 'Microsoft.Network/virtualNetworks@2023-09-01' = {
  name: vnetName
  location: location
  tags: tags
  properties: {
    addressSpace: {
      addressPrefixes: [vnetAddressPrefix]
    }
    subnets: [
      {
        name: containerAppsSubnetName
        properties: {
          addressPrefix: containerAppsSubnetPrefix
          networkSecurityGroup: {
            id: containerAppsNsg.id
          }
          delegations: [
            {
              name: 'Microsoft.App.environments'
              properties: {
                serviceName: 'Microsoft.App/environments'
              }
            }
          ]
        }
      }
      {
        name: privateEndpointSubnetName
        properties: {
          addressPrefix: privateEndpointSubnetPrefix
          networkSecurityGroup: {
            id: privateEndpointNsg.id
          }
          privateEndpointNetworkPolicies: 'Disabled'
        }
      }
    ]
  }
}

// ============================================================================
// Outputs
// ============================================================================

output vnetId string = vnet.id
output vnetName string = vnet.name
output containerAppsSubnetId string = vnet.properties.subnets[0].id
output containerAppsSubnetName string = vnet.properties.subnets[0].name
output privateEndpointSubnetId string = vnet.properties.subnets[1].id
output privateEndpointSubnetName string = vnet.properties.subnets[1].name
