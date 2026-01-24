// Resource Group module
// Creates a resource group for all application resources

targetScope = 'subscription'

// ============================================================================
// Parameters
// ============================================================================

@description('Name of the resource group')
param name string

@description('Location for the resource group')
param location string

@description('Tags to apply to the resource group')
param tags object = {}

// ============================================================================
// Resource Group
// ============================================================================

resource resourceGroup 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: name
  location: location
  tags: tags
}

// ============================================================================
// Outputs
// ============================================================================

output resourceGroupId string = resourceGroup.id
output resourceGroupName string = resourceGroup.name
