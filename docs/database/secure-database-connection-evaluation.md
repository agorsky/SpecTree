# Secure Database Connection String Storage - Evaluation

**Date**: 2026-02-09  
**Feature**: ENG-72  
**Author**: AI Agent

## Problem Statement

Currently, `SQLSERVER_DATABASE_URL` is stored as a plaintext environment variable in Azure Container Apps. This means the connection string (including the SQL admin password) is visible in the Azure Portal under the Container App's environment variables section. This poses a security risk as anyone with read access to the Container App can view the password.

## Requirements

1. Remove plaintext password from Container App environment variables
2. Maintain compatibility with existing application code (Prisma connection string)
3. Minimize operational complexity
4. Ensure secure storage with encryption at rest
5. Support automated deployment via Bicep templates

## Evaluated Options

### Option 1: Container App Secrets with secretRef

**Implementation**:
- Define secret in Container App's `secrets` section
- Reference secret in environment variable using `secretRef`
- Pass connection string as secure parameter during deployment

**Pros**:
- ✅ Secrets are encrypted at rest
- ✅ Secrets are NOT visible in Azure Portal UI
- ✅ Simple to implement - no additional Azure resources required
- ✅ Native Container App feature with excellent Bicep support
- ✅ No code changes required in application
- ✅ Secrets can be updated without redeploying container image
- ✅ Works seamlessly with existing deployment pipeline

**Cons**:
- ❌ Secrets stored within Container App (not centralized)
- ❌ Secret rotation requires Bicep deployment
- ❌ Limited audit trail compared to Key Vault

**Complexity**: Low  
**Security Level**: Medium-High

---

### Option 2: Azure Key Vault Reference

**Implementation**:
- Store connection string in Azure Key Vault
- Use Key Vault reference in Container App secret definition
- Grant Container App managed identity Key Vault access

**Example**:
```bicep
secrets: [
  {
    name: 'sql-connection-string'
    keyVaultUrl: 'https://kv-spectree-dev.vault.azure.net/secrets/sql-connection-string'
    identity: userAssignedIdentity.id
  }
]
```

**Pros**:
- ✅ Centralized secret management
- ✅ Advanced audit logging and access policies
- ✅ Secret versioning and rotation capabilities
- ✅ RBAC at secret level
- ✅ Supports automatic secret rotation with Azure SQL

**Cons**:
- ❌ Requires additional Azure resource (Key Vault)
- ❌ More complex Bicep template and deployment
- ❌ Additional cost (~$0.03 per 10K operations)
- ❌ Requires managing Key Vault access policies/RBAC
- ❌ Slightly higher latency on Container App startup

**Complexity**: Medium  
**Security Level**: High

---

### Option 3: Managed Identity with SQL AAD Authentication

**Implementation**:
- Configure Azure SQL to accept AAD authentication
- Grant Container App's managed identity SQL access
- Update Prisma connection string to use managed identity (no password)

**Example Connection String**:
```
sqlserver://sql-spectree-dev.database.windows.net:1433;database=sqldb-spectree-dev;Authentication=Active Directory Default;encrypt=true
```

**Pros**:
- ✅ No password to manage at all
- ✅ Best security posture - eliminates password risk entirely
- ✅ Automatic credential rotation (token-based)
- ✅ Fine-grained RBAC at database/table level
- ✅ Full audit trail in AAD logs

**Cons**:
- ❌ Requires significant changes to SQL Server configuration
- ❌ May require Prisma driver updates/configuration changes
- ❌ More complex initial setup
- ❌ Potential compatibility issues with existing SQL admin account
- ❌ Requires AAD Premium for some advanced features
- ❌ Not compatible with local development without workarounds

**Complexity**: High  
**Security Level**: Highest

---

## Decision Matrix

| Criteria | Container App Secrets | Key Vault Reference | Managed Identity |
|----------|----------------------|---------------------|------------------|
| Security | Medium-High | High | Highest |
| Complexity | Low | Medium | High |
| Cost | None | Low ($) | None |
| Operational Overhead | Low | Medium | Medium-High |
| Local Dev Compatibility | High | High | Low |
| Deployment Simplicity | High | Medium | Low |
| Secret Rotation | Manual | Manual/Auto | Automatic |
| Audit Trail | Basic | Advanced | Advanced |

---

## Recommendation

**Choose Option 1: Container App Secrets with secretRef**

### Rationale

1. **Immediate Security Improvement**: Moving from plaintext environment variables to Container App secrets provides immediate security benefits without significant complexity.

2. **Pragmatic Solution**: For a project at this stage, Container App secrets offer the right balance of security and simplicity. The password is encrypted at rest and not visible in the portal.

3. **Low Friction**: No additional Azure resources required, no complex access policy management, and seamless integration with existing Bicep infrastructure.

4. **Easy Migration Path**: If security requirements increase in the future, we can migrate to Key Vault reference (Option 2) with minimal changes to the Bicep template structure.

5. **Development Experience**: Maintains compatibility with local development workflows - developers still use `SQLSERVER_DATABASE_URL` environment variable locally.

### Trade-offs Accepted

- **Limited Centralization**: Secrets are stored per Container App rather than centrally. For a single-app deployment, this is acceptable.
- **Manual Rotation**: Secret rotation requires a deployment. Given that SQL passwords should be rotated infrequently, this is manageable.
- **Basic Audit**: Container App logs secret access, but not as detailed as Key Vault. For current needs, this is sufficient.

---

## Implementation Plan

1. ✅ Bicep already defines secrets section with `sql-connection-string`
2. ✅ Bicep already uses `secretRef` for `SQL_CONNECTION_STRING` environment variable
3. ⚠️  Need to verify environment variable name consistency (`SQLSERVER_DATABASE_URL` vs `SQL_CONNECTION_STRING`)
4. 📝 Update deployment documentation to explain secure pattern
5. 🧪 Test Bicep template compilation

---

## Future Considerations

**When to upgrade to Key Vault (Option 2)**:
- Multiple Container Apps need the same connection string
- Compliance requirements mandate centralized secret management
- Need automated secret rotation workflows
- Advanced audit requirements

**When to upgrade to Managed Identity (Option 3)**:
- Eliminating password management becomes critical
- AAD integration is required for compliance
- Team has capacity for SQL Server AAD configuration
- Local development workflow can accommodate AAD authentication

---

## Security Best Practices (Regardless of Option)

1. ✅ Use secure parameters (`@secure()`) in Bicep to prevent logging
2. ✅ Never commit connection strings to source control
3. ✅ Use different credentials for each environment (dev/staging/prod)
4. ✅ Implement principle of least privilege for SQL user accounts
5. ✅ Enable SQL Server audit logging
6. ✅ Rotate SQL passwords on a defined schedule (quarterly minimum)
7. ✅ Monitor Container App logs for unauthorized access attempts

---

## Conclusion

Container App secrets with `secretRef` provide an excellent security improvement over plaintext environment variables with minimal complexity. The existing Bicep template already implements this pattern correctly. The primary remaining work is documentation and verification of environment variable naming consistency.
