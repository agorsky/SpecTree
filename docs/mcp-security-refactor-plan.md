# MCP Security Refactor - Implementation Plan

## Overview

Create a SpecTree project with features and tasks to refactor the MCP server from direct database access to secure API-based authentication with Azure Key Vault integration.

## The Problem

The current MCP server (`packages/mcp`) connects directly to the database using `DATABASE_URL` with **plaintext credentials** stored in `~/.copilot/mcp-config.json`:

```json
{
  "spectree": {
    "env": {
      "DATABASE_URL": "sqlserver://localhost:1433;database=spectree;user=sa;password=LocalDev@Password123;..."
    }
  }
}
```

This is a security risk because:
1. Credentials are stored in plaintext in a config file
2. MCP runs in the user's local environment (less secure than server)
3. Direct database access bypasses API authentication/authorization

## Target Architecture

**Current (Insecure):**
```
MCP → Direct Prisma/DB Connection (via DATABASE_URL)
```

**Target (Secure):**
```
MCP → HTTP API (with API Token) → Azure Key Vault → Managed Identity → Azure SQL
```

## Existing Infrastructure

The API already has:
- JWT authentication middleware (`packages/api/src/middleware/authenticate.ts`)
- Full REST endpoints for projects, features, tasks, statuses
- JWT tokens (15min access, 7d refresh)

The MCP currently:
- Uses Prisma directly in `packages/mcp/src/tools/*.ts`
- Bypasses all API authentication

---

## Instructions for Agent

**Create a project in SpecTree with the following structure:**

### Project Details
- **Name:** `Enterprise Secrets & API Authentication`
- **Team:** `Engineering`
- **Description:** Refactor MCP server to use secure API authentication instead of direct database access. Implement Azure Key Vault for secrets management and Managed Identity for production database connections.
- **Color:** `#DC2626` (red - security)
- **Icon:** `lock`

### Feature 1: API Token Authentication System
**Title:** API Token Authentication System  
**Description:** Implement long-lived API tokens for MCP and other programmatic clients, separate from short-lived JWT user tokens.

**Tasks:**
1. **Create API tokens database schema**
   - Add `api_tokens` table with fields: id, name, token_hash, user_id, scopes, expires_at, last_used_at, created_at
   - Add migration file
   - Tokens should be hashed (never store plaintext)

2. **Implement token generation endpoint**
   - POST `/api/tokens` - Create new API token
   - Return token only once at creation (cannot be retrieved later)
   - Require user authentication to create tokens
   - Support optional expiration and scope limiting

3. **Implement token validation middleware**
   - Create `authenticateApiToken` middleware
   - Check `Authorization: Bearer <token>` header
   - Validate token hash against database
   - Update `last_used_at` on each use
   - Attach user context to request

4. **Add token management endpoints**
   - GET `/api/tokens` - List user's tokens (metadata only, not token values)
   - DELETE `/api/tokens/:id` - Revoke a token
   - Support token rotation (create new, delete old)

5. **Write unit tests for token system**
   - Test token generation, validation, revocation
   - Test expiration handling
   - Test scope enforcement

### Feature 2: Refactor MCP to Use API Client
**Title:** Refactor MCP to Use HTTP API Client  
**Description:** Replace all direct Prisma database calls in MCP with HTTP API calls using the new token authentication.

**Tasks:**
1. **Create HTTP API client library**
   - Create `packages/mcp/src/api-client.ts`
   - Implement methods for all MCP operations (projects, features, tasks, statuses)
   - Handle authentication header injection
   - Implement retry logic and error handling

2. **Refactor projects.ts to use API client**
   - Replace `prisma.project.*` calls with API client calls
   - Remove direct Prisma imports
   - Maintain same MCP tool interface

3. **Refactor features.ts to use API client**
   - Replace `prisma.feature.*` calls with API client calls
   - Update helper functions (resolveProjectId, resolveStatusId)

4. **Refactor tasks.ts to use API client**
   - Replace `prisma.task.*` calls with API client calls
   - Update identifier resolution logic

5. **Refactor statuses.ts to use API client**
   - Replace `prisma.status.*` calls with API client calls
   - Update team resolution logic

6. **Refactor search.ts and ordering.ts**
   - Convert remaining direct database calls
   - Ensure all MCP tools use API client

7. **Update MCP configuration**
   - Change from `DATABASE_URL` env var to `API_TOKEN` env var
   - Add `API_BASE_URL` env var (default: http://localhost:3001)
   - Update documentation for new configuration

8. **Write integration tests**
   - Test MCP tools work correctly through API
   - Test error handling when API is unavailable
   - Test token authentication flow

### Feature 3: Azure Key Vault Integration
**Title:** Azure Key Vault Integration  
**Description:** Integrate Azure Key Vault for secure secrets management in production environments.

**Tasks:**
1. **Add Azure Key Vault SDK dependencies**
   - Add `@azure/keyvault-secrets` and `@azure/identity` packages
   - Update package.json in api package

2. **Create secrets service abstraction**
   - Create `packages/api/src/services/secretsService.ts`
   - Define interface: `getSecret(name): Promise<string>`
   - Implement environment variable fallback for local dev

3. **Implement Azure Key Vault provider**
   - Create Key Vault client using DefaultAzureCredential
   - Implement secret retrieval with caching (secrets don't change often)
   - Add error handling for Key Vault unavailability

4. **Refactor database connection to use secrets service**
   - Move connection string assembly to use secrets service
   - Support both local (env var) and production (Key Vault) modes
   - Add `SECRETS_PROVIDER` env var (values: "env" | "azure-keyvault")

5. **Document Key Vault setup**
   - Document required Azure resources
   - Document required permissions and access policies
   - Add setup instructions to README

### Feature 4: Azure Managed Identity for Database
**Title:** Azure Managed Identity for Database Authentication  
**Description:** Implement Azure Managed Identity for passwordless database authentication in production.

**Tasks:**
1. **Research Azure SQL + Managed Identity requirements**
   - Document Azure SQL configuration needed
   - Document managed identity types (system vs user-assigned)
   - Identify Prisma/SQL Server driver support

2. **Implement managed identity authentication**
   - Add token-based authentication to database connection
   - Use `@azure/identity` to acquire tokens
   - Configure Prisma for token-based auth

3. **Create connection string builder**
   - Build connection strings dynamically based on environment
   - Local: username/password from env or Key Vault
   - Production: managed identity token

4. **Add health check for database connectivity**
   - Verify managed identity can connect
   - Add diagnostic endpoint for troubleshooting
   - Log authentication method being used

5. **Test in Azure environment**
   - Deploy to Azure App Service with managed identity
   - Verify connectivity to Azure SQL
   - Document any Azure-specific configuration

### Feature 5: Documentation & Migration Guide
**Title:** Documentation and Migration Guide  
**Description:** Comprehensive documentation for the new security architecture and migration guide for existing deployments.

**Tasks:**
1. **Update MCP README with new configuration**
   - Document API_TOKEN and API_BASE_URL env vars
   - Remove DATABASE_URL documentation
   - Add troubleshooting section

2. **Create security architecture document**
   - Document the new authentication flow
   - Include architecture diagrams
   - Explain security benefits

3. **Write migration guide**
   - Step-by-step migration from direct DB to API
   - How to generate and configure API tokens
   - Rollback procedures if issues arise

4. **Create Azure deployment guide**
   - Key Vault setup instructions
   - Managed identity configuration
   - Azure SQL firewall and access rules

5. **Update CONTRIBUTING.md**
   - Document local development setup
   - Explain how to work with the new auth system
   - Add security best practices section

---

## Prompt for New Session

Copy and paste this prompt into your new Copilot CLI session:

```
Please read the file at ~/.copilot/session-state/3e7afbc2-b31b-4dcc-96a3-33b96d952e75/files/mcp-security-refactor-plan.md and create the SpecTree project with all features and tasks as documented. Use the SpecTree MCP tools to create:
1. The project under the Engineering team
2. All 5 features with their descriptions
3. All tasks under each feature with detailed descriptions

Create tasks one at a time (not in parallel) to avoid unique constraint errors.
```

---

## Important Notes

1. **Create tasks sequentially** - There was a race condition bug (now fixed) but creating tasks one at a time is safer
2. **Use team name "Engineering"** - The UUID resolution bug has been fixed, so "Engineering" should work now
3. **Status "Backlog"** - Use "Backlog" as the initial status for all features
4. **The fix applied** - The MCP now validates UUIDs before calling `findUnique` to prevent SQL Server conversion errors
