# COM-214: Technology Stack & Architecture Implementation Prompts

This document contains optimized prompts for implementing COM-214 (Technology Stack & Architecture Decisions) and all its sub-issues using Claude Code.

## Execution Order

These prompts should be executed in sequence as there are dependencies:

1. **COM-215** - Validate MCP SDK (no dependencies)
2. **COM-216** - Azure Infrastructure (no dependencies, can run parallel with COM-215)
3. **COM-217** - Azure SQL Security (depends on COM-216)
4. **COM-218** - Project Scaffolding (can start after COM-215 validates stack)
5. **COM-219** - Prisma Configuration (depends on COM-217, COM-218)
6. **COM-220** - React Frontend (depends on COM-218)
7. **COM-221** - Documentation (depends on all above)

---

## COM-215: Validate MCP SDK with TypeScript Stack

**Objective:** Create a minimal proof-of-concept to validate the MCP SDK works with the proposed stack.

### Prompt

```
Implement COM-215: Validate MCP SDK with TypeScript stack.

Create a minimal MCP server proof-of-concept in a new directory called `mcp-poc/`:

1. Initialize a Node.js project with TypeScript:
   - Use Node.js 20 LTS
   - TypeScript 5.x with strict mode
   - ESM modules

2. Install and configure @modelcontextprotocol/sdk

3. Create a simple MCP server (src/index.ts) with:
   - One test tool called "echo" that returns the input message
   - Stdio transport configuration
   - Proper TypeScript types

4. Add a test script and verify the tool responds correctly

5. Create a brief VALIDATION.md documenting:
   - Installation steps
   - Any issues encountered
   - TypeScript type compatibility
   - Claude Code connection instructions

Acceptance criteria:
- MCP SDK installs without issues
- Simple tool responds correctly
- TypeScript types work correctly
- Document any blocking issues
```

---

## COM-216: Create Azure Infrastructure with Bicep/Terraform

**Objective:** Create Infrastructure-as-Code for all Azure resources.

### Prompt

```
Implement COM-216: Create Azure infrastructure with Bicep.

Create Azure IaC in the `infra/` directory using Bicep (Azure-native):

1. Create modular Bicep structure:
   ```
   infra/
     main.bicep              - Main orchestration
     modules/
       resourceGroup.bicep   - Resource group
       vnet.bicep            - Virtual network with subnets
       containerApps.bicep   - Container Apps Environment + App
       sqlServer.bicep       - Azure SQL Server + Database
       keyVault.bicep        - Key Vault with private endpoint
       privateEndpoints.bicep - Private endpoints for SQL/KV
     parameters/
       dev.bicepparam        - Dev environment parameters
       prod.bicepparam       - Production parameters
   ```

2. Configure resources:
   - Virtual Network with subnets for Container Apps, Private Endpoints
   - Azure Container Apps Environment (consumption plan)
   - Azure SQL Server (deny public access) + Database (Basic tier for dev)
   - Key Vault with firewall enabled
   - Private endpoints for SQL and Key Vault
   - Managed identities for Container App

3. Add deployment script (deploy.sh) using Azure CLI

4. Security requirements:
   - No public IP for SQL Database
   - Key Vault firewall enabled
   - TLS 1.2 minimum
   - Container Apps behind VNet

Acceptance criteria:
- All resources deploy successfully via `az deployment`
- SQL Database accessible only via private endpoint
- Key Vault accessible only via private endpoint
- Deployment is repeatable and idempotent
```

---

## COM-217: Configure Azure SQL Security and Access

**Objective:** Set up Azure SQL Database with proper security configuration.

### Prompt

```
Implement COM-217: Configure Azure SQL security and access.

Extend the Bicep infrastructure from COM-216 to include SQL security:

1. Update infra/modules/sqlServer.bicep:
   - Azure AD admin configuration
   - Firewall rules (deny public by default)
   - TLS 1.2 minimum enforcement
   - Auditing and threat detection enabled

2. Create a SQL setup script (infra/scripts/setup-sql-user.sql):
   - Create application user with minimal permissions
   - Grant only required database roles (db_datareader, db_datawriter)
   - Revoke unnecessary permissions

3. Update Key Vault module to store:
   - SQL connection string as secret
   - Application user credentials

4. Create infra/scripts/add-dev-firewall.sh:
   - Temporarily add current IP for local development
   - Include removal script

5. Document connection process in infra/README.md

Acceptance criteria:
- Database accessible via private endpoint only
- Public network access disabled
- Application user has minimal required permissions
- Connection string stored in Key Vault
- Auditing enabled
- Local dev connection documented
```

---

## COM-218: Set Up Project Scaffolding and Monorepo Structure

**Objective:** Create the initial project structure with all tooling configured.

### Prompt

```
Implement COM-218: Set up project scaffolding and monorepo structure.

Create a pnpm workspaces monorepo with Turborepo:

1. Initialize root project:
   ```
   /
     package.json           - pnpm workspaces config
     pnpm-workspace.yaml    - Workspace definition
     turbo.json             - Turborepo pipeline config
     tsconfig.base.json     - Shared TypeScript config
     .eslintrc.cjs          - ESLint config
     .prettierrc            - Prettier config
     docker-compose.yml     - Local dev services
   ```

2. Create package structure:
   ```
   /packages
     /api/                  - Express backend
       package.json
       tsconfig.json
       src/index.ts         - Basic Express server with health endpoint
     /web/                  - React frontend (placeholder)
       package.json
       tsconfig.json
     /mcp/                  - MCP server (move from mcp-poc)
       package.json
       tsconfig.json
     /shared/               - Shared types/utilities
       package.json
       tsconfig.json
       src/index.ts
   ```

3. Configure tooling:
   - TypeScript 5.x with strict mode (extend base config)
   - ESLint with @typescript-eslint
   - Prettier with consistent settings
   - Vitest for testing (configure in turbo.json)

4. Add Docker configuration:
   - Dockerfile for api package
   - docker-compose.yml with api service
   - .dockerignore files

5. Create .env.example files for each package

6. Add root scripts: build, dev, lint, test, typecheck

Acceptance criteria:
- `pnpm install` succeeds
- `pnpm build` builds all packages
- `pnpm lint` runs without errors
- `pnpm typecheck` passes in strict mode
- Docker compose starts api service
```

---

## COM-219: Configure Prisma with Azure SQL

**Objective:** Set up Prisma ORM to work with Azure SQL Database.

### Prompt

```
Implement COM-219: Configure Prisma with Azure SQL.

Set up Prisma in the api package:

1. Install dependencies in packages/api:
   - prisma (dev dependency)
   - @prisma/client

2. Create Prisma schema (packages/api/prisma/schema.prisma):
   ```prisma
   datasource db {
     provider = "sqlserver"
     url      = env("DATABASE_URL")
   }

   generator client {
     provider = "prisma-client-js"
   }

   // Test model to validate setup
   model HealthCheck {
     id        String   @id @default(uuid())
     timestamp DateTime @default(now())
     status    String
   }
   ```

3. Create database utilities (packages/api/src/lib/db.ts):
   - Prisma client singleton
   - Connection health check function

4. Update the Express server:
   - Add /health endpoint that writes to HealthCheck table
   - Add /db-status endpoint to verify connection

5. Add npm scripts to packages/api:
   - db:generate - prisma generate
   - db:push - prisma db push
   - db:migrate - prisma migrate dev

6. Document in packages/api/README.md:
   - Azure SQL connection string format
   - Local development setup
   - Migration workflow

Connection string format:
sqlserver://SERVER.database.windows.net:1433;database=spectree;user=USER;password=PASS;encrypt=true;trustServerCertificate=false

Acceptance criteria:
- Prisma connects to Azure SQL
- Migrations run successfully
- CRUD operations work via health endpoint
- Works in Docker container
- Connection string format documented
```

---

## COM-220: Set Up React Frontend with Vite and Tailwind

**Objective:** Create React frontend scaffolding ready for UI implementation.

### Prompt

```
Implement COM-220: Set up React frontend with Vite and Tailwind.

Set up the web package with React, Vite, Tailwind, and Shadcn/ui:

1. Initialize Vite project in packages/web:
   - React 18 + TypeScript template
   - Configure path aliases (@/ -> src/)

2. Install and configure Tailwind CSS 3.x:
   - tailwind.config.js with custom theme
   - postcss.config.js
   - Base styles in src/index.css

3. Initialize Shadcn/ui:
   - Run: npx shadcn-ui@latest init
   - Configure components.json for path aliases
   - Add base components: Button, Input, Card, ThemeProvider

4. Set up React Router:
   - Install react-router-dom
   - Create basic routes: /, /about (placeholder pages)
   - Create src/routes.tsx

5. Create layout structure:
   ```
   src/
     components/
       layout/
         Header.tsx
         Sidebar.tsx
         Layout.tsx
     pages/
       Home.tsx
       About.tsx
     lib/
       utils.ts (cn utility from shadcn)
   ```

6. Add dark mode support:
   - ThemeProvider component
   - Toggle button in Header
   - Persist preference in localStorage

7. Configure for monorepo:
   - Update vite.config.ts for workspace dependencies
   - Ensure @shared package imports work

Acceptance criteria:
- `pnpm dev` starts Vite dev server
- Tailwind classes apply correctly
- Shadcn/ui Button, Input, Card render properly
- Router navigation works between pages
- Dark mode toggle works and persists
- `pnpm build` produces production bundle
```

---

## COM-221: Document Local Development Setup

**Objective:** Create comprehensive documentation for local development.

### Prompt

```
Implement COM-221: Document local development setup.

Create comprehensive documentation:

1. Update root README.md:
   ```markdown
   # SpecTree

   ## Prerequisites
   - Node.js 20 LTS
   - pnpm 8+
   - Docker Desktop
   - Azure CLI (authenticated)

   ## Quick Start
   1. Clone repository
   2. pnpm install
   3. Copy .env.example files
   4. Configure Azure connection
   5. pnpm dev

   ## Project Structure
   [Describe monorepo layout]

   ## Available Commands
   [List all pnpm scripts]

   ## Environment Variables
   [Reference table for all env vars]
   ```

2. Create CONTRIBUTING.md:
   - Code style guidelines (ESLint/Prettier config)
   - Git workflow (branch naming, commit format)
   - PR process and review checklist
   - Testing requirements

3. Create docs/LOCAL_DEVELOPMENT.md:
   - Detailed Azure SQL connection setup
   - How to add your IP to firewall
   - How to get connection string from Key Vault
   - Docker development workflow

4. Create docs/MCP_SETUP.md:
   - How to configure Claude Code to use the MCP server
   - claude_desktop_config.json example
   - Troubleshooting common issues

5. Create docs/DEPLOYMENT.md:
   - Azure Container Apps deployment process
   - Environment promotion (dev -> prod)
   - Rollback procedures

6. Add troubleshooting section to each doc:
   - Common errors and solutions
   - Debug logging instructions
   - Support contact info

Acceptance criteria:
- New developer can complete setup following README
- All environment variables documented with descriptions
- Azure connection process is clear step-by-step
- Claude Code MCP setup fully documented
- Troubleshooting covers common issues
```

---

## Parallel Execution Strategy

For maximum efficiency, you can run some prompts in parallel using Claude Code sub-agents:

### Phase 1 (Parallel)
- COM-215: MCP SDK Validation
- COM-216: Azure Infrastructure

### Phase 2 (After Phase 1)
- COM-217: Azure SQL Security (needs COM-216)

### Phase 3 (After COM-215, COM-217)
- COM-218: Project Scaffolding

### Phase 4 (After COM-218, Parallel)
- COM-219: Prisma Configuration
- COM-220: React Frontend

### Phase 5 (After All)
- COM-221: Documentation

---

## Tips for Using These Prompts

1. **Use Plan Mode**: For complex issues like COM-216 and COM-218, start with `/plan` to let Claude explore the codebase first.

2. **Verify Acceptance Criteria**: After each implementation, explicitly ask Claude to verify all acceptance criteria are met.

3. **Incremental Commits**: After each sub-issue, create a commit:
   ```
   /commit -m "feat: COM-XXX - [description]"
   ```

4. **Run Tests**: After COM-218 sets up Vitest, run tests after each change:
   ```
   pnpm test
   ```

5. **Check TypeScript**: Regularly verify types:
   ```
   pnpm typecheck
   ```
