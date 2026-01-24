# Research: Express.js vs Fastify Framework Decision

## Context

This document describes a discrepancy discovered during analysis of Linear issue COM-152 (Core REST API) and its sub-issues. The discrepancy requires a decision before implementation can proceed.

## The Discrepancy

### What COM-153 Specifies

Linear issue COM-153 ("1. Set up Express.js server with middleware") explicitly specifies:

- **Framework**: Express.js
- **File locations**: `src/server.ts` (entry point), `src/app.ts` (Express app configuration)
- **Middleware stack**:
  - `cors()` - CORS handling
  - `express.json()` - JSON body parsing
  - `helmet()` - security headers
  - `morgan()` - request logging
  - `compression()` - response compression
- **Configuration**: Port from environment variable with fallback

### What the Codebase Currently Has

The existing implementation at `packages/api/src/index.ts` uses **Fastify**, not Express:

```typescript
import Fastify from "fastify";
import cors from "@fastify/cors";
import { prisma } from "./lib/db.js";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const HOST = process.env.HOST ?? "0.0.0.0";

async function main(): Promise<void> {
  const fastify = Fastify({
    logger: true,  // Built-in logging (replaces morgan)
  });

  await fastify.register(cors, {
    origin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  });

  // Graceful shutdown
  fastify.addHook("onClose", async () => {
    await prisma.$disconnect();
  });

  // Health endpoints and CRUD examples exist...
}
```

## Current Infrastructure State

### What Exists

| Component | Status | Location |
|-----------|--------|----------|
| Fastify server | Working | `packages/api/src/index.ts` |
| CORS middleware | Configured | `@fastify/cors` |
| Request logging | Configured | Fastify built-in logger |
| Prisma client | Working | `packages/api/src/lib/db.ts` |
| Database schema | Complete | `packages/api/prisma/schema.prisma` |
| Health check CRUD | Working example | `packages/api/src/index.ts` |

### What's Missing (per COM-153)

| Component | Express Equivalent | Fastify Equivalent |
|-----------|-------------------|-------------------|
| Security headers | `helmet()` | `@fastify/helmet` |
| Response compression | `compression()` | `@fastify/compress` |
| Separate app config | `src/app.ts` | Not separated |

## Framework Comparison

### Express.js

- **Maturity**: Released 2010, most popular Node.js framework
- **Ecosystem**: Largest middleware ecosystem
- **Learning curve**: Lower, more documentation/tutorials
- **Performance**: Good, but slower than Fastify
- **Pattern**: Middleware chain, `app.use()`, `req/res` objects

### Fastify

- **Maturity**: Released 2016, second most popular
- **Ecosystem**: Growing, most Express middleware has Fastify equivalents
- **Learning curve**: Slightly higher, less documentation
- **Performance**: 2-3x faster than Express in benchmarks
- **Pattern**: Plugin system, schema-based validation, `request/reply` objects

### Middleware Equivalency

| Express | Fastify | Notes |
|---------|---------|-------|
| `cors` | `@fastify/cors` | API nearly identical |
| `helmet` | `@fastify/helmet` | API nearly identical |
| `compression` | `@fastify/compress` | API nearly identical |
| `morgan` | Built-in `logger: true` | Fastify uses Pino |
| `express.json()` | Built-in | Automatic JSON parsing |
| `express-validator` / Zod | `@fastify/type-provider-zod` | Native schema support |

## Decision Options

### Option A: Keep Fastify (Adapt Issues)

**Actions required**:
1. Update COM-153 description to reference Fastify instead of Express
2. Add missing middleware (`@fastify/helmet`, `@fastify/compress`)
3. Optionally refactor to separate `app.ts` from `server.ts`
4. Proceed with CRUD implementations using Fastify patterns

**Pros**:
- No migration work needed
- Existing code continues to work
- Better performance characteristics
- Schema-based validation integrates well with Zod (COM-161)

**Cons**:
- Linear issues will not match implementation
- Team members expecting Express may be confused
- Less community resources for troubleshooting

### Option B: Migrate to Express (Follow Issues)

**Actions required**:
1. Install Express and middleware packages
2. Rewrite `packages/api/src/index.ts` using Express patterns
3. Rewrite health check endpoints in Express style
4. Update `package.json` dependencies
5. Remove Fastify dependencies

**Pros**:
- Implementation matches issue specifications exactly
- More familiar to most Node.js developers
- Larger ecosystem for future needs

**Cons**:
- Discards working code
- Migration effort and risk
- Lower performance

### Option C: Hybrid Approach

**Actions required**:
1. Keep Fastify for this project
2. Create a project memory/decision record documenting the choice
3. Update COM-153 to reflect "verify and enhance existing Fastify setup"
4. Add comment in Linear explaining the deviation

## Research Questions for Further Investigation

1. **Team preference**: Does the team have a stated preference for Express vs Fastify?
2. **Other projects**: What framework do other projects in this organization use?
3. **Performance requirements**: Are there specific performance targets that favor one framework?
4. **Deployment target**: Does Azure App Service or the deployment platform have any framework preferences?
5. **Future integrations**: Are there planned integrations that work better with one framework?

## Files to Examine

- `packages/api/package.json` - Current dependencies
- `packages/api/src/index.ts` - Current server implementation
- `packages/api/src/lib/db.ts` - Prisma client setup
- `packages/api/prisma/schema.prisma` - Database schema (framework-agnostic)

## Related Linear Issues

- **COM-152**: Core REST API (parent issue)
- **COM-153**: Set up Express.js server with middleware (specifies Express)
- **COM-154 - COM-160**: CRUD endpoints (framework-agnostic patterns)
- **COM-161**: Zod validation (Fastify has native Zod integration)
- **COM-162**: Error handling middleware (patterns differ slightly between frameworks)

## Recommendation

Pending further research, the preliminary recommendation is **Option A (Keep Fastify)** because:

1. Working infrastructure should not be discarded without strong justification
2. The CRUD endpoint patterns are nearly identical between frameworks
3. Fastify's native schema validation aligns well with COM-161 (Zod validation)
4. The issue descriptions are implementation guides, not strict requirements

However, this decision should be validated against team preferences and organizational standards before proceeding.
