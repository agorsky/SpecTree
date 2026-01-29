# MCP Security Refactor - Implementation Plan

> **Last Updated:** 2026-01-29  
> **Status:** Feature 1 COMPLETE, Features 2-5 NOT STARTED

## Overview

Create a SpecTree project with features and tasks to refactor the MCP server from direct database access to secure API-based authentication with Azure Key Vault integration.

## The Problem

The current MCP server (`packages/mcp`) connects directly to the database using `DATABASE_URL` stored in `~/.copilot/mcp-config.json`:

```json
{
  "spectree": {
    "env": {
      "DATABASE_URL": "file:./data/spectree.db"
    }
  }
}
```

This is a security risk because:
1. MCP runs in the user's local environment (less secure than server)
2. Direct database access bypasses API authentication/authorization
3. In production with Azure SQL, credentials would be exposed

## Current State (as of 2026-01-29)

### What Has Changed Since Original Plan

| Item | Original Plan | Current State |
|------|---------------|---------------|
| Database | SQL Server (Azure SQL Edge) | **SQLite** (migrated) |
| Connection String | `sqlserver://localhost:1433;...` | `file:./data/spectree.db` |
| API Token System | Not implemented | **✅ IMPLEMENTED** (ENG-10) |
| MCP Database Access | Direct Prisma | Still direct Prisma (unchanged) |
| Azure Key Vault | Not implemented | Not implemented |
| Managed Identity | Not implemented | Not applicable (SQLite) |

### Migration to SQLite

The project migrated from SQL Server to SQLite. See `docs/sql-server-to-sqlite-migration.md` for details.

**Impact on this plan:**
- Feature 4 (Azure Managed Identity for Database) is **no longer applicable** for local development
- SQLite doesn't require complex authentication - it's file-based
- For Azure deployment, may use Azure SQL or continue with SQLite on Azure Files

## Target Architecture

**Current:**
```
MCP → Direct Prisma/SQLite (via DATABASE_URL file path)
```

**Target (Local):**
```
MCP → HTTP API (with API Token) → SQLite
```

**Target (Azure Production):**
```
MCP → HTTP API (with API Token) → Azure Key Vault → Azure SQL (or SQLite on Azure Files)
```

## Existing Infrastructure

The API now has:
- ✅ JWT authentication middleware (`packages/api/src/middleware/authenticate.ts`)
- ✅ **API Token authentication** (added in ENG-10)
- ✅ Full REST endpoints for projects, features, tasks, statuses
- ✅ Token endpoints: POST/GET/DELETE `/api/v1/tokens`

The MCP currently:
- ❌ Uses Prisma directly in `packages/mcp/src/tools/*.ts`
- ❌ Bypasses all API authentication

---

## Instructions for Agent

**Create a project in SpecTree with the following structure:**

### Project Details
- **Name:** `Enterprise Secrets & API Authentication`
- **Team:** `Engineering`
- **Description:** Refactor MCP server to use secure API authentication instead of direct database access. Implement Azure Key Vault for secrets management in production.
- **Color:** `#DC2626` (red - security)
- **Icon:** `lock`

### Feature 1: API Token Authentication System ✅ COMPLETE
**Title:** API Token Authentication System  
**Status:** ✅ **IMPLEMENTED** (ENG-10, 2026-01-28)
**Description:** Implement long-lived API tokens for MCP and other programmatic clients, separate from short-lived JWT user tokens.

**Completed Tasks:**
1. ✅ **API tokens database schema** - `api_tokens` table with id, name, token_hash, user_id, scopes, expires_at, last_used_at, created_at
2. ✅ **Token generation endpoint** - POST `/api/v1/tokens` creates new API token, returns token once
3. ✅ **Token validation middleware** - Extended `authenticate.ts` to support API tokens (st_ prefix)
4. ✅ **Token management endpoints** - GET `/api/v1/tokens` (list), DELETE `/api/v1/tokens/:id` (revoke)
5. ✅ **Unit tests** - 25 tests covering generation, validation, revocation, edge cases

**Implementation Files:**
- `packages/api/prisma/schema.prisma` - ApiToken model
- `packages/api/src/services/tokenService.ts` - Token service
- `packages/api/src/routes/tokens.ts` - Token endpoints
- `packages/api/src/middleware/authenticate.ts` - Extended for API tokens
- `packages/api/tests/api/tokens.test.ts` - Tests

### Feature 2: Refactor MCP to Use API Client ⏳ NOT STARTED
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

### Feature 3: Azure Key Vault Integration ⏳ NOT STARTED
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

4. **Refactor configuration to use secrets service**
   - JWT_SECRET from Key Vault in production
   - Any other sensitive configuration
   - Add `SECRETS_PROVIDER` env var (values: "env" | "azure-keyvault")

5. **Document Key Vault setup**
   - Document required Azure resources
   - Document required permissions and access policies
   - Add setup instructions to README

### Feature 4: Azure SQL Database Support ⏳ OPTIONAL
**Title:** Azure SQL Database Support  
**Description:** Add support for Azure SQL as an alternative to SQLite for production deployments requiring higher concurrency.

> **Note:** This feature is OPTIONAL. SQLite works well for SpecTree's use case (low concurrency, single-user MCP access). Azure SQL is only needed if scaling to multiple concurrent users.

**Tasks:**
1. **Research multi-provider Prisma setup**
   - Document how to support both SQLite and SQL Server providers
   - Evaluate schema compatibility

2. **Implement Azure SQL connection with Managed Identity**
   - Token-based authentication using `@azure/identity`
   - Configure Prisma for token-based auth

3. **Create connection string builder**
   - Build connection strings dynamically based on environment
   - Local: SQLite file path
   - Production: Azure SQL with managed identity

4. **Add provider selection configuration**
   - `DATABASE_PROVIDER` env var (values: "sqlite" | "azure-sql")
   - Automatic provider detection

5. **Test and document Azure SQL deployment**
   - Deploy to Azure App Service
   - Verify connectivity
   - Document Azure-specific configuration

### Feature 5: Documentation & Migration Guide ⏳ NOT STARTED
**Title:** Documentation and Migration Guide  
**Description:** Comprehensive documentation for the new security architecture and migration guide for existing deployments.

**Tasks:**
1. **Update MCP README with new configuration**
   - Document API_TOKEN and API_BASE_URL env vars
   - Remove DATABASE_URL documentation (for MCP)
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
   - Optional: Azure SQL configuration
   - Azure Container Apps / App Service deployment

5. **Update CONTRIBUTING.md**
   - Document local development setup
   - Explain how to work with the new auth system
   - Add security best practices section

---

## Progress Summary

| Feature | Status | Notes |
|---------|--------|-------|
| Feature 1: API Token Authentication | ✅ Complete | Implemented as ENG-10 |
| Feature 2: MCP API Client Refactor | ⏳ Not Started | High priority - main security goal |
| Feature 3: Azure Key Vault | ⏳ Not Started | Production only |
| Feature 4: Azure SQL Support | ⏳ Optional | Only if SQLite doesn't scale |
| Feature 5: Documentation | ⏳ Not Started | Depends on Feature 2 |

## Prompt for New Session

Copy and paste this prompt into your new Copilot CLI session:

```
Please read the file at docs/mcp-security-refactor-plan.md and create the SpecTree project with all features and tasks as documented. 

Note: Feature 1 (API Token Authentication) is already complete - mark those tasks as Done.

Use the SpecTree MCP tools to create:
1. The project under the Engineering team
2. All 5 features with their descriptions
3. All tasks under each feature with detailed descriptions

Create tasks one at a time (not in parallel) to avoid unique constraint errors.
```

---

## Important Notes

1. **Feature 1 is complete** - API tokens are already implemented (ENG-10)
2. **SQLite is now the database** - No SQL Server credentials to protect locally
3. **Feature 4 is optional** - SQLite works for the current use case
4. **Main goal is Feature 2** - Refactor MCP to use API instead of direct DB access
5. **Create tasks sequentially** - Avoids race condition issues with identifier generation
