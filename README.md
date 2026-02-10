# SpecTree

Project Management & Issue Tracking Platform

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Development](#development)
- [Testing](#testing)
- [API Features](#api-features)
- [MCP Server with Claude Code](#mcp-server-with-claude-code)
- [Database](#database)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

## Overview

SpecTree is a Linear-inspired project management tool with support for:

- **Team-based collaboration** — Organize work into teams with role-based access (admin, member, guest)
- **Personal scopes** — Private workspace for personal projects and tasks not shared with any team
- **Hierarchical work items** — Projects contain features, which contain tasks
- **Customizable workflows** — Each team (and personal scope) has its own workflow statuses
- **Structured descriptions** — Rich, AI-friendly descriptions with extractable sections
- **Code context** — Link features/tasks to files, functions, git branches, commits, and PRs
- **Validation checklists** — Executable acceptance criteria that verify work is truly "done"
- **Implementation plan templates** — Reusable templates for creating standardized work structures
- **AI integration** — Full MCP server support for AI assistants like Claude

### Identity & Collaboration Model

SpecTree implements an invite-only collaboration model:

| Concept | Description |
|---------|-------------|
| **Personal Scope** | Each user has a private container for personal work (auto-created on signup) |
| **Team Membership** | Users must be explicitly invited to teams (no auto-join) |
| **Scope Isolation** | Personal data is only visible to the owner; team data requires membership |
| **Admin Guardrails** | Teams always have at least one admin (cannot remove/demote last admin) |

## Prerequisites

Before you begin, ensure you have the following installed:

| Tool | Version | Installation |
|------|---------|--------------|
| **Node.js** | 20.0.0+ | [nodejs.org](https://nodejs.org/) or `nvm install 20` |
| **pnpm** | 9.0.0+ | `npm install -g pnpm` or `corepack enable` |
| **Docker** | Latest | [docker.com](https://www.docker.com/products/docker-desktop/) (optional, for containerized deployment) |
| **Azure CLI** | Latest | [Install Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli) (for deployment only) |

> **Note**: The database uses SQLite, which is file-based and requires no separate database server or Docker for local development.

### Verify Installation

```bash
node --version    # Should be v20.x.x or higher
pnpm --version    # Should be 9.x.x or higher
az --version      # Optional, for Azure deployment
```

## Quick Start

Get up and running in under 5 minutes:

```bash
# 1. Clone the repository
git clone <repository-url>
cd SpecTree

# 2. Install dependencies
pnpm install

# 3. Set up environment variables
cp .env.example .env

# 4. Create the database and seed initial data
pnpm --filter @spectree/api db:push
pnpm --filter @spectree/api db:seed

# 5. Build all packages
pnpm build

# 6. Start development servers
pnpm dev
```

After these steps:
- **API server** runs at http://localhost:3001
- **Web app** runs at http://localhost:5173
- **Database** is at `packages/api/prisma/data/spectree.db`

## Project Structure

```
SpecTree/
├── packages/
│   ├── api/          # Fastify backend API
│   │   ├── src/      # Source code
│   │   ├── prisma/   # Database schema and migrations
│   │   └── Dockerfile
│   ├── web/          # React frontend (Vite)
│   │   ├── src/      # Source code
│   │   └── Dockerfile
│   ├── mcp/          # MCP server for AI integrations
│   │   └── src/      # MCP server source
│   ├── orchestrator/ # CLI for parallel AI agent execution
│   │   └── src/      # Orchestrator source
│   └── shared/       # Shared types and utilities
├── infra/            # Azure Bicep infrastructure files
│   ├── modules/      # Bicep modules
│   ├── parameters/   # Environment-specific parameters
│   └── scripts/      # Deployment helper scripts
├── scripts/          # Development and utility scripts
│   ├── backup-db.sh  # Database backup script
│   ├── restore-db.sh # Database restore script
│   └── local-dev.sh  # Local development helper
├── docker-compose.yml
├── turbo.json        # Turborepo configuration
└── pnpm-workspace.yaml
```

### Package Dependencies

```
@spectree/shared  ─── No dependencies (base package)
       │
       ├── @spectree/api         (depends on shared)
       ├── @spectree/web         (depends on shared)
       └── @spectree/mcp         (depends on shared)

@spectree/orchestrator ─── Standalone (own REST client/MCP bridge, no internal deps)
```

## Environment Variables

Copy `.env.example` to `.env` and configure as needed:

```bash
cp .env.example .env
```

### Local Development Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `file:./data/spectree.db` | SQLite database file path (relative to prisma directory) |
| `API_PORT` | `3001` | API server port |
| `API_HOST` | `0.0.0.0` | API server bind address |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed CORS origin |
| `NODE_ENV` | `development` | Environment mode |

### Azure Variables (Production)

| Variable | Description |
|----------|-------------|
| `AZURE_KEY_VAULT_URI` | Key Vault URI for secrets |
| `AZURE_CLIENT_ID` | Managed identity client ID |

## Development

### Available Commands

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all dependencies |
| `pnpm build` | Build all packages |
| `pnpm dev` | Start development servers (API + Web) |
| `pnpm test` | Run all tests |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm lint` | Run ESLint on all packages |
| `pnpm lint:fix` | Fix ESLint issues automatically |
| `pnpm format` | Format code with Prettier |
| `pnpm format:check` | Check code formatting |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm clean` | Remove build artifacts and node_modules |

### Docker Commands (Optional)

Docker is only needed for containerized deployment, not for local development:

| Command | Description |
|---------|-------------|
| `pnpm docker:up --profile full` | Start full stack in containers (API + Web) |
| `pnpm docker:down` | Stop Docker services |
| `pnpm docker:logs` | View Docker service logs |

### Database Commands (API package)

```bash
# Generate Prisma client
pnpm --filter @spectree/api db:generate

# Push schema changes to database (development)
pnpm --filter @spectree/api db:push

# Create a migration
pnpm --filter @spectree/api db:migrate

# Deploy migrations (production)
pnpm --filter @spectree/api db:migrate:deploy

# Open Prisma Studio (database GUI)
pnpm --filter @spectree/api db:studio

# Seed the database
pnpm --filter @spectree/api db:seed
```

### Running Individual Packages

```bash
# Build a specific package
pnpm --filter @spectree/api build
pnpm --filter @spectree/web build
pnpm --filter @spectree/mcp build
pnpm --filter @spectree/orchestrator build

# Run a specific package in dev mode
pnpm --filter @spectree/api dev
pnpm --filter @spectree/web dev

# Run tests for a specific package
pnpm --filter @spectree/api test
pnpm --filter @spectree/orchestrator test
```

### Database Backup & Restore

The database is a single SQLite file, making backup and restore simple:

#### Creating a Backup

```bash
./scripts/backup-db.sh
```

Backups are stored in `./backups/` with timestamp filenames (e.g., `spectree_20240115_143052.db`).

#### Restoring from Backup

```bash
./scripts/restore-db.sh ./backups/spectree_YYYYMMDD_HHMMSS.db
```

#### Manual Backup

For a quick manual backup, simply copy the database file:

```bash
cp packages/api/prisma/data/spectree.db packages/api/prisma/data/spectree-backup.db
```

### SQLite Database Notes

- **File location**: `packages/api/prisma/data/spectree.db`
- **View data**: Use Prisma Studio with `pnpm --filter @spectree/api db:studio`
- **Portability**: The database is a single file—easy to backup, copy, or share
- **No server needed**: No separate database process required for development

### Docker Compose Profiles

Docker is optional and only needed for containerized deployment:

```bash
# Full stack: Start API and web in containers
docker-compose --profile full up -d
```

## Testing

Tests are run using [Vitest](https://vitest.dev/).

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests for a specific package
pnpm --filter @spectree/api test
pnpm --filter @spectree/web test
pnpm --filter @spectree/mcp test

# Run tests with coverage
pnpm test -- --coverage
```

### Test Configuration

The project uses a shared Vitest configuration at the root level (`vitest.config.ts`):

- **Test environment**: Node.js
- **Coverage provider**: V8
- **Test pattern**: `**/*.{test,spec}.{ts,tsx}`

## API Features

### Search & Filtering

The API provides powerful search and filtering capabilities for features and tasks.

#### Text Search

Search features and tasks by title and description (case-insensitive, partial matches supported):

```bash
GET /api/v1/features?query=authentication
GET /api/v1/tasks?query=login
```

#### Filter by Status

Filter by status ID, name, or category:

```bash
# By status name
GET /api/v1/features?status=Todo
GET /api/v1/features?status=In%20Progress

# By status category (backlog, unstarted, started, completed, canceled)
GET /api/v1/features?statusCategory=started

# Multiple statuses (OR logic)
GET /api/v1/features?status=todo&status=in_progress
```

#### Filter by Assignee

Filter by assignee with special values:

```bash
# Current authenticated user
GET /api/v1/features?assignee=me

# Unassigned items
GET /api/v1/features?assignee=none

# By email
GET /api/v1/features?assignee=user@example.com

# By user ID
GET /api/v1/features?assignee=550e8400-e29b-41d4-a716-446655440000
```

#### Filter by Date Range

Filter by creation or update date with ISO-8601 dates or durations:

```bash
# Items created in the last 7 days
GET /api/v1/features?createdAt=-P7D

# Items created after a specific date
GET /api/v1/features?createdAt=2024-01-01

# Items updated in the last month
GET /api/v1/tasks?updatedAt=-P1M

# Items created before a date
GET /api/v1/features?createdBefore=2024-06-01
```

**Duration format**: `-P{n}D` (days), `-P{n}W` (weeks), `-P{n}M` (months)

#### Combined Filters

All filters can be combined (AND logic):

```bash
# Search for auth-related features assigned to me, created in the last 30 days
GET /api/v1/features?query=auth&assignee=me&createdAt=-P30D

# In-progress tasks updated recently
GET /api/v1/tasks?statusCategory=started&updatedAt=-P7D
```

### Personal Scope API (`/me/*`)

Personal scope endpoints allow users to manage their private workspace:

```bash
# Get personal scope (auto-creates if doesn't exist)
GET /api/v1/me/scope

# List personal projects
GET /api/v1/me/projects

# Create personal project
POST /api/v1/me/projects
{
  "name": "Side Project Ideas",
  "description": "Personal project tracking"
}

# List personal workflow statuses
GET /api/v1/me/statuses

# Create personal status
POST /api/v1/me/statuses
{
  "name": "Research",
  "category": "started"
}
```

Personal scope features and tasks use the same `/api/v1/features` and `/api/v1/tasks` endpoints—they're automatically scoped by the project they belong to.

### Validation Checklists

Tasks support executable validation checks that define "done" in a verifiable way:

```bash
# List validations for a task
GET /api/v1/tasks/:id/validations

# Add a validation check
POST /api/v1/tasks/:id/validations
{
  "type": "command",
  "description": "Tests pass",
  "command": "pnpm test"
}

# Run a single validation
POST /api/v1/tasks/:id/validations/:checkId/run

# Run all validations
POST /api/v1/tasks/:id/validations/run-all
{
  "stopOnFailure": false,
  "workingDirectory": "/path/to/project"
}

# Mark manual validation as passed
POST /api/v1/tasks/:id/validations/:checkId/manual-validate
{
  "notes": "Verified by team lead"
}

# Reset all validations to pending
POST /api/v1/tasks/:id/validations/reset

# Remove a validation check
DELETE /api/v1/tasks/:id/validations/:checkId
```

**Validation Types**:
- `command` — Run shell command, check exit code
- `file_exists` — Verify file exists
- `file_contains` — Search file content with regex
- `test_passes` — Run test command (2 min default timeout)
- `manual` — Requires human verification

### Progress Summary (Dashboard)

Progress summary endpoints provide comprehensive project status for dashboards and AI session starts:

```bash
# Get progress summary for an epic (counts, blockers, actionable items)
GET /api/v1/epics/:id/progress-summary

# Get current user's work across all epics
GET /api/v1/me/work

# Get all blocked items across all accessible epics
GET /api/v1/me/blocked
```

**Progress Summary Response** includes:
- Epic info (id, name, description)
- Feature/task counts (total, completed, inProgress, blocked)
- Overall progress percentage and estimated remaining work
- Blocked items needing attention
- Next actionable items (unblocked, ready to work)
- Recently completed items
- Last session context (if available)

## MCP Server with Claude Code

The SpecTree MCP server enables AI assistants like Claude to interact with the project management platform through secure API token authentication.

### Orchestrator CLI

SpecTree includes a powerful CLI tool (`@spectree/orchestrator`) for parallel AI agent execution:

```bash
# Install globally
npm install -g @spectree/orchestrator

# Authenticate
spectree-agent auth --token st_your-token-here

# Create and execute epic from natural language
spectree-agent run "Build user authentication with OAuth" --team Engineering

# Resume existing epic
spectree-agent continue "User Authentication"

# Check progress
spectree-agent status
```

**Key Features:**
- Natural language to implementation planning
- Parallel agent execution (multiple features at once)
- Git branch management per feature
- Real-time progress tracking
- Session pause/resume with context preservation

See [`packages/orchestrator/README.md`](./packages/orchestrator/README.md) for full documentation.

### MCP Server Documentation

> **📚 Detailed Documentation**: See [`docs/MCP/`](./docs/MCP/) for comprehensive guides on:
> - [Tools Reference](./docs/MCP/tools-reference.md) — Complete MCP tools documentation
> - [Progress Summary](./docs/MCP/progress-summary.md) — Dashboard and status summaries for AI sessions
> - [AI Session Context](./docs/MCP/ai-session-context.md) — Cross-session context transfer for AI agents
> - [Execution Metadata](./docs/MCP/execution-metadata.md) — Execution planning for AI agents
> - [Validation Checklists](./docs/MCP/validation-checklists.md) — Executable acceptance criteria for tasks
> - [Decision Log](./docs/MCP/decision-log.md) — Append-only decision records for preserving rationale
> - [API Token Authentication](./docs/MCP/api-token-authentication.md) — Token system details
> - [Security Architecture](./docs/MCP/security-architecture.md) — Security model
> - [Migration Guide](./docs/MCP/migration-guide.md) — Migrating from older configurations
> - [Azure Deployment](./docs/azure-deployment-guide.md) — Production deployment

### Quick Setup

#### 1. Build the MCP Server

```bash
pnpm --filter @spectree/mcp build
```

#### 2. Start the API Server

The MCP server requires the API server to be running:

```bash
pnpm dev
```

#### 3. Generate an API Token

Create a token via the API (requires a JWT from login):

```bash
# Login to get a JWT
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@spectree.dev","password":"Password123!"}'

# Create an API token (use the accessToken from login response)
curl -X POST http://localhost:3001/api/v1/tokens \
  -H "Authorization: Bearer <your-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"name": "MCP Server"}'

# Save the returned token (st_xxx...) - it's only shown once!
```

#### 4. Configure Claude Code

Add the MCP server to your Claude Code configuration (`~/.claude/settings.json` or project `.claude/settings.json`):

```json
{
  "mcpServers": {
    "spectree": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/SpecTree/packages/mcp/dist/index.js"],
      "env": {
        "API_TOKEN": "st_your_token_here",
        "API_BASE_URL": "http://localhost:3001"
      }
    }
  }
}
```

> **⚠️ Security Note**: The `API_TOKEN` provides authenticated access to SpecTree. Keep it secure and never commit it to version control.

### Verifying MCP Connection

After configuring, restart Claude Code and verify the connection:

1. The MCP server should appear in the list of available tools
2. Ask Claude to list epics: "List all epics in SpecTree"

### MCP Server Development

```bash
# Run MCP server in watch mode (rebuilds on changes)
pnpm --filter @spectree/mcp dev

# Run MCP server directly
pnpm --filter @spectree/mcp start
```

### Available MCP Tools

| Tool | Description |
|------|-------------|
| **Search** | |
| `spectree__search` | Unified search across features and tasks with all filter options |
| **Epics** | |
| `spectree__list_epics` | List epics with optional team/scope filtering |
| `spectree__get_epic` | Get epic details by ID or name |
| `spectree__create_epic` | Create a new team-scoped epic |
| `spectree__reorder_epic` | Change epic position within its team |
| **Features** | |
| `spectree__list_features` | List features with optional filters |
| `spectree__get_feature` | Get feature details by ID or identifier |
| `spectree__create_feature` | Create a new feature in a project |
| `spectree__update_feature` | Update feature title, status, assignee, etc. |
| `spectree__reorder_feature` | Change feature position within its project |
| **Tasks** | |
| `spectree__list_tasks` | List tasks with optional filters |
| `spectree__get_task` | Get task details by ID or identifier |
| `spectree__create_task` | Create a new task under a feature |
| `spectree__update_task` | Update task title, status, assignee, etc. |
| `spectree__reorder_task` | Change task position within its feature |
| **Statuses** | |
| `spectree__list_statuses` | List workflow statuses for a team |
| `spectree__get_status` | Get status details by ID or name |
| **Personal Scope** | |
| `spectree__get_personal_scope` | Get user's personal scope info (creates if needed) |
| `spectree__list_personal_projects` | List epics in personal scope |
| `spectree__create_personal_project` | Create an epic in personal scope |
| `spectree__list_personal_statuses` | List workflow statuses in personal scope |
| **Execution Planning** | |
| `spectree__get_execution_plan` | Get ordered execution plan for an epic |
| `spectree__set_execution_metadata` | Set execution order, parallelization, dependencies |
| `spectree__mark_blocked` | Mark feature/task as blocked by another |
| `spectree__mark_unblocked` | Remove a blocker from feature/task |
| **AI Context** | |
| `spectree__get_ai_context` | Get AI context for cross-session continuity |
| `spectree__set_ai_context` | Set structured context for successor sessions |
| `spectree__append_ai_note` | Append observation/decision/blocker notes |
| **Templates** | |
| `spectree__list_templates` | List available implementation plan templates |
| `spectree__get_template` | Get template details and variables |
| `spectree__preview_template` | Preview what will be created from template |
| `spectree__create_from_template` | Create epic/features/tasks from template |
| `spectree__save_as_template` | Save existing epic structure as template |
| **Structured Descriptions** | |
| `spectree__get_structured_description` | Get parsed structured description |
| `spectree__set_structured_description` | Replace entire structured description |
| `spectree__update_section` | Update single section of structured description |
| `spectree__add_acceptance_criterion` | Append acceptance criterion to list |
| `spectree__link_file` | Add file path to filesInvolved |
| `spectree__add_external_link` | Add external URL reference |
| **Code Context** | |
| `spectree__link_code_file` | Link a source file to feature/task |
| `spectree__unlink_code_file` | Remove a file link |
| `spectree__link_function` | Link a function (filePath:functionName) |
| `spectree__link_branch` | Set git branch for feature/task |
| `spectree__link_commit` | Add commit SHA to feature/task |
| `spectree__link_pr` | Link pull request to feature/task |
| `spectree__get_code_context` | Get all code context for feature/task |
| **Decision Log** | |
| `spectree__log_decision` | Record a decision with rationale |
| `spectree__list_decisions` | List decisions with filters |
| `spectree__search_decisions` | Search decisions by text |
| `spectree__get_decision_context` | Get decisions for task/feature context |
| **Help** | |
| `spectree__get_instructions` | Get usage instructions and best practices |

### Getting Started (AI Agents)

AI agents can call `spectree__get_instructions` to learn about SpecTree capabilities and recommended workflows. This tool returns comprehensive guidance on:

- Available tools and their usage
- Execution metadata for planning work
- Search and filtering capabilities
- Recommended workflow patterns

> **Example**: `spectree__get_instructions({ topic: "execution" })` returns guidance on planning dependencies and parallel work.

### Execution Metadata

Features and Tasks support execution metadata to help AI agents plan work:

- **executionOrder** — Suggested order (1, 2, 3...)
- **canParallelize** — Whether item can run alongside others
- **parallelGroup** — Group ID for items that can run together
- **dependencies** — IDs of items that must complete first
- **estimatedComplexity** — `trivial`, `simple`, `moderate`, or `complex`

> **📚 Full Documentation**: See [`docs/MCP/execution-metadata.md`](./docs/MCP/execution-metadata.md)

### Search Tool (`spectree__search`)

The search tool provides powerful filtering capabilities for AI assistants:

```
Parameters:
  query         - Text search in title/description
  epic          - Filter by epic name or ID
  status        - Filter by status name or ID
  statusCategory - Filter by category (backlog, unstarted, started, completed, canceled)
  assignee      - Filter by assignee ("me", "none", email, or UUID)
  createdAt     - Date filter (ISO date or duration like "-P7D")
  updatedAt     - Date filter for last update
  type          - "feature", "task", or "all" (default)
  limit         - Results per page (default: 50, max: 100)
  cursor        - Pagination cursor
```

Results include a `type` field ("feature" or "task") to distinguish item types.

## Database

### Local Development (SQLite)

Local development uses SQLite, a file-based database that requires no separate server:

```bash
# Database location
packages/api/prisma/data/spectree.db

# Create database and apply schema
pnpm --filter @spectree/api db:push

# Seed initial data
pnpm --filter @spectree/api db:seed

# View data with Prisma Studio
pnpm --filter @spectree/api db:studio
```

### Production (Azure SQL)

Production deployments use Azure SQL. Azure SQL databases use private endpoints and are not publicly accessible. See [`infra/README.md`](./infra/README.md) for deployment details.

## Deployment

### Prerequisites for Deployment

1. Azure CLI installed and authenticated: `az login`
2. Bicep CLI installed: `az bicep install`
3. Appropriate Azure permissions (Contributor or Owner)

### Deploy to Azure

```bash
# Navigate to infrastructure directory
cd infra

# Preview changes (what-if deployment)
./deploy.sh -e dev --what-if

# Validate templates
./deploy.sh -e dev --validate

# Deploy to development
./deploy.sh -e dev

# Deploy to production
./deploy.sh -e prod

# Deploy with specific subscription
./deploy.sh -e dev -s <subscription-id>
```

### Deployment Options

| Option | Description |
|--------|-------------|
| `-e, --environment` | Environment: `dev`, `staging`, or `prod` (required) |
| `-l, --location` | Azure region (default: `eastus`) |
| `-n, --name` | Base resource name (default: `spectree`) |
| `-s, --subscription` | Azure subscription ID |
| `--what-if` | Preview changes without deploying |
| `--validate` | Validate templates only |

### Post-Deployment Steps

1. **Create application database user** (see `infra/README.md`)
2. **Grant Container App access to Key Vault**
3. **Configure DNS** (if using custom domain)

For detailed Azure infrastructure documentation, see [`infra/README.md`](./infra/README.md).

## Troubleshooting

### Common Issues

#### pnpm install fails

**Symptoms**: Dependency resolution errors

**Solutions**:
1. Clear pnpm cache: `pnpm store prune`
2. Delete node_modules and lockfile: `rm -rf node_modules pnpm-lock.yaml && pnpm install`
3. Ensure correct Node.js version: `node --version` (should be 20+)

#### TypeScript errors after pulling changes

**Symptoms**: Type errors in IDE or during build

**Solutions**:
1. Rebuild all packages: `pnpm build`
2. Regenerate Prisma client: `pnpm --filter @spectree/api db:generate`
3. Restart TypeScript server in your IDE

#### Database issues

**Symptoms**: Database file not found or connection errors

**Solutions**:
1. Ensure database exists: `pnpm --filter @spectree/api db:push`
2. Check file exists: `ls packages/api/prisma/data/spectree.db`
3. Verify DATABASE_URL in `.env`: should be `file:./data/spectree.db`
4. Reset database: delete the db file and run `db:push` again

#### MCP server not appearing in Claude Code

**Symptoms**: Tools not available after configuration

**Solutions**:
1. Verify MCP server is built: `pnpm --filter @spectree/mcp build`
2. Ensure API server is running: `pnpm dev`
3. Verify `API_TOKEN` is set correctly in MCP config (starts with `st_`)
4. Check configuration path is correct and absolute
5. Restart Claude Code completely
6. Check Claude Code logs for connection errors

#### MCP authentication errors

**Symptoms**: "Invalid or expired API token" errors

**Solutions**:
1. Generate a new token if the old one expired or was revoked
2. Verify token is copied correctly (including `st_` prefix)
3. Ensure the API server is running and accessible at `API_BASE_URL`
4. Check that the user associated with the token is still active

#### Azure deployment fails

**Symptoms**: Bicep deployment error

**Solutions**:
1. Verify Azure CLI login: `az account show`
2. Check subscription permissions
3. Run validation: `./deploy.sh -e dev --validate`
4. Review error details in Azure Portal → Deployments

### Getting Help

- Check existing issues in the repository
- Review logs: browser console for frontend
- For Azure issues: Check Azure Portal activity logs

## Technology Stack

| Category | Technology |
|----------|------------|
| **Runtime** | Node.js 20+ |
| **Package Manager** | pnpm with workspaces |
| **Build System** | Turborepo |
| **Language** | TypeScript (strict mode) |
| **Backend** | Fastify 5 |
| **Frontend** | React 19 + Vite 6 |
| **Styling** | Tailwind CSS 4 |
| **Components** | Radix UI |
| **Database** | SQLite (local), Azure SQL (production) |
| **ORM** | Prisma |
| **Testing** | Vitest |
| **Linting** | ESLint 9 (flat config) |
| **Formatting** | Prettier |
| **Infrastructure** | Azure (Bicep) |

## Documentation

Additional documentation is available in the `docs/` directory:

| Document | Description |
|----------|-------------|
| [Database Safety Guide](./docs/database-safety-guide.md) | Critical safety rules for database operations |
| [Identity & Collaboration Reference](./docs/identity-collaboration-vnext-implementation-reference.md) | Implementation details for personal scopes and team membership |
| [MCP Tools Reference](./docs/MCP/tools-reference.md) | Complete reference for all MCP tools |
| [MCP AI Session Context](./docs/MCP/ai-session-context.md) | Cross-session context transfer for AI agents |
| [MCP Execution Metadata](./docs/MCP/execution-metadata.md) | Execution planning and dependencies for AI agents |
| [MCP Templates Guide](./docs/MCP/templates.md) | Implementation plan templates for AI agents |
| [MCP Structured Descriptions](./docs/MCP/structured-descriptions.md) | Rich structured descriptions for AI-friendly data extraction |
| [MCP Code Context](./docs/MCP/code-context.md) | Codebase integration - link code artifacts to features/tasks |
| [MCP Decision Log](./docs/MCP/decision-log.md) | Append-only decision records for preserving rationale |
| [MCP Documentation](./docs/MCP/) | MCP server setup, authentication, and security |
| [Azure Deployment Guide](./docs/azure-deployment-guide.md) | Production deployment to Azure |
