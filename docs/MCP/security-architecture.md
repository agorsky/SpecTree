# Security Architecture

> **SpecTree MCP Integration Security Model**
>
> This document explains the security architecture for MCP (Model Context Protocol) integration with SpecTree, detailing the authentication flow, threat model, and security benefits of the API-based approach.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Authentication Flow](#authentication-flow)
4. [Token Security](#token-security)
5. [Security Benefits](#security-benefits)
6. [Threat Model](#threat-model)
7. [Security Best Practices](#security-best-practices)

---

## Executive Summary

SpecTree has implemented a secure API-based authentication system for MCP integration, replacing direct database access with token-authenticated API requests. This architectural change provides:

- **Defense in depth** — Multiple security layers between external tools and data
- **Separation of concerns** — MCP tools have no database access; all operations go through the API
- **Auditability** — All requests are authenticated and can be logged
- **Revocability** — Access can be instantly revoked by invalidating tokens

This architecture ensures that AI assistants and automation tools can safely interact with SpecTree without exposing database credentials or allowing unrestricted data access.

---

## Architecture Overview

### Previous Architecture (Insecure)

The original MCP integration used direct database access:

```
┌──────────────────┐                                    ┌──────────────────┐
│                  │         Direct DB Access           │                  │
│    MCP Server    │ ─────────────────────────────────▶ │   SQLite DB      │
│    (Copilot)     │         (DATABASE_URL)             │                  │
│                  │                                    │                  │
└──────────────────┘                                    └──────────────────┘

Problems:
• MCP has unrestricted read/write access to all data
• No authentication or authorization layer
• Database credentials exposed in MCP environment variables
• No audit trail of operations
• Cannot revoke access without changing database
• Vulnerable to data exfiltration by compromised AI tools
```

### New Architecture (Secure)

The new architecture routes all MCP requests through the authenticated API:

```
┌──────────────────┐        API Request         ┌──────────────────┐        DB Query         ┌──────────────────┐
│                  │ ─────────────────────────▶ │                  │ ─────────────────────▶ │                  │
│    MCP Server    │       Bearer Token          │   API Server     │     Prisma ORM         │    Database      │
│    (Copilot)     │      (API_TOKEN)           │                  │                        │                  │
│                  │ ◀───────────────────────── │                  │ ◀───────────────────── │                  │
└──────────────────┘        JSON Response       └──────────────────┘       Query Result     └──────────────────┘

Benefits:
• MCP only has API access, never direct database access
• All requests authenticated via API token
• API enforces business logic, validation, and permissions
• Database credentials remain on the server only
• Complete audit trail through API logging
• Instant revocation by deleting token
```

### Component Responsibilities

| Component | Responsibility | Has DB Access |
|-----------|---------------|---------------|
| MCP Server | Translates AI tool calls to API requests | ❌ No |
| API Server | Authenticates requests, enforces business logic | ✅ Yes |
| Database | Stores application data and token hashes | — |

---

## Authentication Flow

### Request Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              Authentication Flow                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘

  1. User generates API token          2. Token configured              3. MCP sends request
     in SpecTree UI                       in MCP settings                  with Bearer token
         │                                     │                                │
         ▼                                     ▼                                ▼
┌─────────────────┐                  ┌─────────────────┐              ┌─────────────────┐
│   Web UI        │                  │   MCP Config    │              │   MCP Server    │
│  "Create Token" │ ────────────▶   │   API_TOKEN=    │ ──────────▶  │  HTTP Request   │
│                 │  Copy token      │   st_xxx...     │              │  Bearer st_xxx  │
└─────────────────┘                  └─────────────────┘              └─────────────────┘
         │                                                                    │
         │ Hash stored                                                        │
         ▼                                                                    ▼
┌─────────────────┐                                                  ┌─────────────────┐
│   Database      │                                                  │   API Server    │
│  token_hash     │ ◀──────────────────────────────────────────────  │  Validate Token │
│  (SHA-256)      │              4. Hash lookup                      │                 │
└─────────────────┘                                                  └─────────────────┘
                                                                             │
                                    5. Return user context                   │
                                       if token valid                        ▼
                                                                     ┌─────────────────┐
                                    6. Process request               │   Route Handler │
                                       with user context             │  Business Logic │
                                                                     └─────────────────┘
                                                                             │
                                    7. Return response                       │
                                                                             ▼
                                                                     ┌─────────────────┐
                                                                     │   MCP Server    │
                                                                     │  JSON Response  │
                                                                     └─────────────────┘
```

### Step-by-Step Flow

1. **Token Generation** — User creates an API token through the SpecTree web interface
2. **Secure Storage** — Token is SHA-256 hashed; only the hash is stored in the database
3. **Configuration** — User configures MCP with the plaintext token (shown only once)
4. **Request** — MCP sends API requests with `Authorization: Bearer st_xxx` header
5. **Validation** — API server hashes the incoming token and looks up the hash
6. **User Context** — If valid, the associated user is attached to the request
7. **Processing** — Request is processed with full user context and permissions
8. **Response** — JSON response returned to MCP

### Token Detection

The API server differentiates between JWT and API tokens by prefix:

```typescript
if (token.startsWith("st_")) {
  // API Token authentication
  await authenticateWithApiToken(request, token);
} else {
  // JWT authentication (web UI sessions)
  await authenticateWithJwt(request, token);
}
```

---

## Token Security

### Token Generation

API tokens use cryptographically secure random generation:

| Property | Value |
|----------|-------|
| Random bytes | 32 bytes (256 bits of entropy) |
| Encoding | Base64URL (URL-safe, no padding) |
| Prefix | `st_` (SpecTree identifier) |
| Example | `st_K7xH2mPqR5vN8sT1wY4zA6bC9dE0fG3hI...` |

### Token Storage

**Critical security principle: Plaintext tokens are NEVER stored.**

```
Generation:                          Storage:
┌─────────────────┐                  ┌─────────────────┐
│ crypto.random   │                  │   Database      │
│ Bytes(32)       │──▶ SHA-256 ────▶ │   token_hash    │
│                 │     hash         │   (hex string)  │
└─────────────────┘                  └─────────────────┘
        │
        │ Returned to user ONCE
        ▼
┌─────────────────┐
│ st_K7xH2mPq...  │
│ (plaintext)     │
└─────────────────┘
```

### Token Properties

| Property | Implementation |
|----------|---------------|
| **Entropy** | 256 bits (computationally infeasible to guess) |
| **Hashing** | SHA-256 (irreversible, one-way function) |
| **Display** | Shown exactly once at creation |
| **Expiration** | Optional; tokens can be permanent or time-limited |
| **Revocation** | Instant; delete the token record |
| **Scopes** | Optional permission restrictions (future enhancement) |

### Why SHA-256 Hashing?

If the database is compromised, attackers cannot:

1. **Recover tokens** — SHA-256 is a one-way function
2. **Use stolen hashes** — The API validates plaintext tokens, not hashes
3. **Enumerate valid tokens** — 256-bit entropy makes brute force infeasible

---

## Security Benefits

### Comparison Matrix

| Aspect | Before (Direct DB) | After (API Token) |
|--------|-------------------|-------------------|
| **Database Access** | Direct, unrestricted | Via API only |
| **Credential Exposure** | DB path in MCP env | Token only (no DB access) |
| **Authentication** | None | Per-request validation |
| **Authorization** | None | User context, permissions |
| **Audit Trail** | None | API logs all requests |
| **Revocation** | Change DB credentials | Instant token deletion |
| **Blast Radius** | Full database | Single user's permissions |

### Defense in Depth

The new architecture implements multiple security layers:

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1: Network                                               │
│  • HTTPS encryption in transit                                  │
│  • API only accessible from configured origins                  │
├─────────────────────────────────────────────────────────────────┤
│  Layer 2: Authentication                                        │
│  • Valid API token required                                     │
│  • Token must not be expired                                    │
│  • Associated user must be active                               │
├─────────────────────────────────────────────────────────────────┤
│  Layer 3: Authorization                                         │
│  • User context attached to requests                            │
│  • Business logic enforces permissions                          │
│  • Users can only access their own data                         │
├─────────────────────────────────────────────────────────────────┤
│  Layer 4: Data Validation                                       │
│  • All inputs validated via Zod schemas                         │
│  • Parameterized queries prevent SQL injection                  │
│  • Output sanitization prevents data leakage                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Threat Model

### Threats Mitigated

#### 1. Unauthorized Data Access

**Before:** MCP could read any data in the database without restriction.

**After:** MCP can only access data through authenticated API endpoints that enforce user permissions.

#### 2. SQL Injection

**Before:** If MCP constructed queries (theoretically possible with direct DB access), SQL injection was a risk.

**After:** All queries go through Prisma ORM with parameterized queries. MCP has no ability to construct SQL.

#### 3. Privilege Escalation

**Before:** MCP had full database access regardless of which user initiated the action.

**After:** API tokens are scoped to a specific user. All actions are performed in that user's context.

#### 4. Credential Theft

**Before:** `DATABASE_URL` in MCP environment gave permanent, unchangeable access.

**After:** API tokens can be instantly revoked. Stolen tokens can be invalidated without reconfiguring the database.

#### 5. Data Exfiltration by Compromised AI

**Before:** A compromised AI tool could dump the entire database.

**After:** A compromised AI tool can only make API calls as the configured user, with full audit logging.

#### 6. Insider Threat

**Before:** Anyone with access to MCP config had full database access.

**After:** MCP config only contains a revocable API token. Access can be audited and revoked.

### Residual Risks

| Risk | Mitigation |
|------|------------|
| Token theft | Use environment variables; never commit tokens |
| Overprivileged tokens | Implement scope restrictions (planned) |
| Token not rotated | Set expiration dates; rotate periodically |
| API server compromise | Standard server hardening; secrets in Key Vault |

---

## Security Best Practices

### For Users

1. **Store tokens securely**
   - Use environment variables, not config files
   - Never commit tokens to version control
   - Use secret managers in production (Azure Key Vault)

2. **Set expiration dates**
   - Don't create permanent tokens unless necessary
   - Rotate tokens periodically (every 90 days recommended)

3. **Monitor token usage**
   - Check `lastUsedAt` for unexpected activity
   - Revoke tokens that show suspicious patterns

4. **Principle of least privilege**
   - Create separate tokens for different use cases
   - Use scopes when available to limit permissions

### For Developers

1. **Never log tokens**
   ```typescript
   // ❌ Bad
   console.log(`Token: ${token}`);
   
   // ✅ Good
   console.log(`Token validated for user: ${user.id}`);
   ```

2. **Never return token hashes**
   ```typescript
   // ❌ Bad - exposes hash
   return { ...token, tokenHash: token.tokenHash };
   
   // ✅ Good - omit sensitive fields
   const { tokenHash, ...safeToken } = token;
   return safeToken;
   ```

3. **Always verify ownership**
   ```typescript
   // ✅ Always check before operations
   if (token.userId !== request.user.id) {
     throw new ForbiddenError("Access denied");
   }
   ```

4. **Use constant-time comparison for sensitive operations**
   ```typescript
   // For operations where timing attacks matter
   import { timingSafeEqual } from "crypto";
   ```

### For Deployment

1. **Use HTTPS in production** — Never send tokens over unencrypted connections
2. **Configure CORS properly** — Restrict API access to known origins
3. **Enable rate limiting** — Prevent brute force attempts
4. **Use Azure Key Vault** — Store secrets securely in production
5. **Enable audit logging** — Log all authentication events

---

## Related Documentation

- [API Token Authentication](./api-token-authentication.md) — Detailed API documentation
- [Migration Guide](./migration-guide.md) — Migrating from direct DB to API
- [Azure Deployment](/docs/azure-deployment-guide.md) — Production deployment guide

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-29 | Initial document created for ENG-6-2 |
