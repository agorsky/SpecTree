// Front Door module
// Creates Azure Front Door Standard tier with WAF policy, origin groups, and routing rules
// Architecture: Internet → Front Door (WAF) → Origins → Container Apps

// ============================================================================
// Parameters
// ============================================================================

@description('Base name for resources')
param baseName string

@description('Environment name')
param environment string

@description('Location for resources (Front Door is global, WAF must be global)')
param location string = 'global'

@description('Tags to apply to resources')
param tags object = {}

@description('FQDN of the API Container App origin')
param containerAppFqdn string

@description('FQDN of the Web Container App origin')
param webContainerAppFqdn string

@description('Enable Front Door deployment (set false to skip)')
param enabled bool = true

// ============================================================================
// Variables
// ============================================================================

var frontDoorProfileName = 'afd-${baseName}-${environment}'
var wafPolicyName = 'wafp${baseName}${environment}' // WAF policy names: alphanumeric only
var endpointName = 'ep-${baseName}-${environment}'
var apiOriginGroupName = 'api-origin-group'
var webOriginGroupName = 'web-origin-group'
var apiOriginName = 'api-origin'
var webOriginName = 'web-origin'
var apiRouteName = 'api-route'
var webRouteName = 'web-route'

// ============================================================================
// WAF Policy
// ============================================================================

resource wafPolicy 'Microsoft.Network/FrontDoorWebApplicationFirewallPolicies@2024-02-01' = if (enabled) {
  name: wafPolicyName
  location: location
  tags: tags
  sku: {
    name: 'Standard_AzureFrontDoor'
  }
  properties: {
    policySettings: {
      enabledState: 'Enabled'
      mode: 'Prevention' // PHASE 4 LOCKDOWN: Active blocking mode
      requestBodyCheck: 'Enabled'
    }
    managedRules: {
      managedRuleSets: [
        {
          ruleSetType: 'Microsoft_DefaultRuleSet'
          ruleSetVersion: '2.1'
          ruleSetAction: 'Block'
        }
        {
          ruleSetType: 'Microsoft_BotManagerRuleSet'
          ruleSetVersion: '1.1'
          ruleSetAction: 'Block'
        }
      ]
    }
  }
}

// ============================================================================
// Front Door Profile (Standard tier)
// ============================================================================

resource frontDoorProfile 'Microsoft.Cdn/profiles@2023-05-01' = if (enabled) {
  name: frontDoorProfileName
  location: location
  tags: tags
  sku: {
    name: 'Standard_AzureFrontDoor'
  }
}

// ============================================================================
// Endpoint
// ============================================================================

resource endpoint 'Microsoft.Cdn/profiles/afdEndpoints@2023-05-01' = if (enabled) {
  parent: frontDoorProfile
  name: endpointName
  location: location
  tags: tags
  properties: {
    enabledState: 'Enabled'
  }
}

// ============================================================================
// Origin Groups
// ============================================================================

resource apiOriginGroup 'Microsoft.Cdn/profiles/originGroups@2023-05-01' = if (enabled) {
  parent: frontDoorProfile
  name: apiOriginGroupName
  properties: {
    loadBalancingSettings: {
      sampleSize: 4
      successfulSamplesRequired: 3
      additionalLatencyInMilliseconds: 50
    }
    healthProbeSettings: {
      probePath: '/health'
      probeRequestType: 'GET'
      probeProtocol: 'Https'
      probeIntervalInSeconds: 30
    }
    sessionAffinityState: 'Disabled'
  }
}

resource webOriginGroup 'Microsoft.Cdn/profiles/originGroups@2023-05-01' = if (enabled) {
  parent: frontDoorProfile
  name: webOriginGroupName
  properties: {
    loadBalancingSettings: {
      sampleSize: 4
      successfulSamplesRequired: 3
      additionalLatencyInMilliseconds: 50
    }
    healthProbeSettings: {
      probePath: '/'
      probeRequestType: 'HEAD'
      probeProtocol: 'Https'
      probeIntervalInSeconds: 30
    }
    sessionAffinityState: 'Disabled'
  }
}

// ============================================================================
// Origins
// ============================================================================

resource apiOrigin 'Microsoft.Cdn/profiles/originGroups/origins@2023-05-01' = if (enabled) {
  parent: apiOriginGroup
  name: apiOriginName
  properties: {
    hostName: containerAppFqdn
    httpPort: 80
    httpsPort: 443
    originHostHeader: containerAppFqdn
    priority: 1
    weight: 1000
    enabledState: 'Enabled'
    enforceCertificateNameCheck: true
  }
}

resource webOrigin 'Microsoft.Cdn/profiles/originGroups/origins@2023-05-01' = if (enabled) {
  parent: webOriginGroup
  name: webOriginName
  properties: {
    hostName: webContainerAppFqdn
    httpPort: 80
    httpsPort: 443
    originHostHeader: webContainerAppFqdn
    priority: 1
    weight: 1000
    enabledState: 'Enabled'
    enforceCertificateNameCheck: true
  }
}

// ============================================================================
// Rule Sets (Caching rules for static assets)
// ============================================================================

resource cacheRuleSet 'Microsoft.Cdn/profiles/ruleSets@2023-05-01' = if (enabled) {
  parent: frontDoorProfile
  name: 'CacheRules'
}

resource staticAssetCacheRule 'Microsoft.Cdn/profiles/ruleSets/rules@2023-05-01' = if (enabled) {
  parent: cacheRuleSet
  name: 'CacheStaticAssets'
  properties: {
    order: 1
    conditions: [
      {
        name: 'UrlFileExtension'
        parameters: {
          typeName: 'DeliveryRuleUrlFileExtensionMatchConditionParameters'
          operator: 'Equal'
          matchValues: [
            'js'
            'css'
            'png'
            'jpg'
            'jpeg'
            'gif'
            'svg'
            'ico'
            'woff'
            'woff2'
            'ttf'
            'eot'
          ]
          negateCondition: false
          transforms: [
            'Lowercase'
          ]
        }
      }
    ]
    actions: [
      {
        name: 'RouteConfigurationOverride'
        parameters: {
          typeName: 'DeliveryRuleRouteConfigurationOverrideActionParameters'
          cacheConfiguration: {
            queryStringCachingBehavior: 'IgnoreQueryString'
            cacheBehavior: 'OverrideAlways'
            cacheDuration: '7.00:00:00'
            isCompressionEnabled: 'Enabled'
          }
        }
      }
    ]
    matchProcessingBehavior: 'Continue'
  }
}

// ============================================================================
// Routes
// ============================================================================

resource apiRoute 'Microsoft.Cdn/profiles/afdEndpoints/routes@2023-05-01' = if (enabled) {
  parent: endpoint
  name: apiRouteName
  properties: {
    originGroup: {
      id: apiOriginGroup.id
    }
    supportedProtocols: [
      'Https'
    ]
    patternsToMatch: [
      '/api/*'
      '/health'
      '/health/*'
    ]
    forwardingProtocol: 'HttpsOnly'
    linkToDefaultDomain: 'Enabled'
    httpsRedirect: 'Enabled'
    cacheConfiguration: {
      queryStringCachingBehavior: 'UseQueryString'
      compressionSettings: {
        isCompressionEnabled: false
      }
    }
  }
  dependsOn: [
    apiOrigin
  ]
}

resource webRoute 'Microsoft.Cdn/profiles/afdEndpoints/routes@2023-05-01' = if (enabled) {
  parent: endpoint
  name: webRouteName
  properties: {
    originGroup: {
      id: webOriginGroup.id
    }
    supportedProtocols: [
      'Https'
    ]
    patternsToMatch: [
      '/*'
    ]
    forwardingProtocol: 'HttpsOnly'
    linkToDefaultDomain: 'Enabled'
    httpsRedirect: 'Enabled'
    ruleSets: [
      {
        id: cacheRuleSet.id
      }
    ]
    cacheConfiguration: {
      queryStringCachingBehavior: 'IgnoreQueryString'
      compressionSettings: {
        isCompressionEnabled: true
        contentTypesToCompress: [
          'text/html'
          'text/css'
          'application/javascript'
          'application/json'
          'image/svg+xml'
          'application/xml'
          'text/plain'
        ]
      }
    }
  }
  dependsOn: [
    webOrigin
    apiRoute // Ensure API route is created first (more specific pattern takes priority)
  ]
}

// ============================================================================
// Security Policy (WAF association)
// ============================================================================

resource securityPolicy 'Microsoft.Cdn/profiles/securityPolicies@2023-05-01' = if (enabled) {
  parent: frontDoorProfile
  name: 'waf-policy-association'
  properties: {
    parameters: {
      type: 'WebApplicationFirewall'
      wafPolicy: {
        id: wafPolicy.id
      }
      associations: [
        {
          domains: [
            {
              id: endpoint.id
            }
          ]
          patternsToMatch: [
            '/*'
          ]
        }
      ]
    }
  }
}

// ============================================================================
// Outputs
// ============================================================================

output frontDoorProfileId string = enabled ? frontDoorProfile.id : ''
output frontDoorProfileName string = enabled ? frontDoorProfile.name : ''
output frontDoorId string = enabled ? frontDoorProfile.properties.frontDoorId : ''
output endpointFqdn string = enabled ? endpoint.properties.hostName : ''
output endpointId string = enabled ? endpoint.id : ''
output wafPolicyId string = enabled ? wafPolicy.id : ''
output wafPolicyName string = enabled ? wafPolicy.name : ''
