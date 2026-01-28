# SpecTree

Project Management & Issue Tracking Platform

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Development](#development)
- [Testing](#testing)
- [API Features](#api-features)
- [MCP Server with Claude Code](#mcp-server-with-claude-code)
- [Azure SQL Connection](#azure-sql-connection)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

## Prerequisites

Before you begin, ensure you have the following installed:

| Tool | Version | Installation |
|------|---------|--------------|
| **Node.js** | 20.0.0+ | [nodejs.org](https://nodejs.org/) or `nvm install 20` |
| **pnpm** | 9.0.0+ | `npm install -g pnpm` or `corepack enable` |
| **Docker** | Latest | [docker.com](https://www.docker.com/products/docker-desktop/) |
| **Docker Compose** | v2+ | Included with Docker Desktop |
| **Azure CLI** | Latest | [Install Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli) (for deployment only) |

### Verify Installation

```bash
node --version    # Should be v20.x.x or higher
pnpm --version    # Should be 9.x.x or higher
docker --version  # Should show Docker version
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

# 4. Start the local database
pnpm docker:up

# 5. Wait for database initialization (~30 seconds)
# Check status with: docker-compose logs -f sqlserver-init

# 6. Build all packages
pnpm build

# 7. Start development servers
pnpm dev
```

After these steps:
- **API server** runs at http://localhost:3001
- **Web app** runs at http://localhost:5173

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
│   └── shared/       # Shared types and utilities
├── infra/            # Azure Bicep infrastructure files
│   ├── modules/      # Bicep modules
│   ├── parameters/   # Environment-specific parameters
│   └── scripts/      # Deployment helper scripts
├── scripts/          # Development and utility scripts
│   ├── init-db.sql   # Database initialization
│   └── local-dev.sh  # Local development helper
├── docker-compose.yml
├── turbo.json        # Turborepo configuration
└── pnpm-workspace.yaml
```

### Package Dependencies

```
@spectree/shared  ─── No dependencies (base package)
       │
       ├── @spectree/api     (depends on shared)
       ├── @spectree/web     (depends on shared)
       └── @spectree/mcp     (depends on shared)
```

## Environment Variables

Copy `.env.example` to `.env` and configure as needed:

```bash
cp .env.example .env
```

### Local Development Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | `localhost` | Database server hostname |
| `DB_PORT` | `1433` | Database server port |
| `DB_NAME` | `spectree` | Database name |
| `DB_USER` | `sa` | Database username |
| `DB_PASSWORD` | `LocalDev@Password123` | Database password |
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
| `pnpm lint` | Run ESLint on all packages |
| `pnpm lint:fix` | Fix ESLint issues automatically |
| `pnpm format` | Format code with Prettier |
| `pnpm format:check` | Check code formatting |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm clean` | Remove build artifacts and node_modules |

### Docker Commands

| Command | Description |
|---------|-------------|
| `pnpm docker:up` | Start Docker services (database) |
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

# Run a specific package in dev mode
pnpm --filter @spectree/api dev
pnpm --filter @spectree/web dev

# Run tests for a specific package
pnpm --filter @spectree/api test
```

### Local Development Helper Script

The `scripts/local-dev.sh` script provides convenient commands:

```bash
./scripts/local-dev.sh start    # Start local environment
./scripts/local-dev.sh stop     # Stop local environment
./scripts/local-dev.sh restart  # Restart environment
./scripts/local-dev.sh status   # Show container status
./scripts/local-dev.sh logs     # View SQL Server logs
./scripts/local-dev.sh connect  # Connect to SQL Server via sqlcmd
./scripts/local-dev.sh reset    # Reset database (delete all data)
```

### Docker Compose Profiles

```bash
# Default: Start only database
docker-compose up -d

# Full stack: Start database, API, and web
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

## MCP Server with Claude Code

The SpecTree MCP server enables AI assistants like Claude to interact with the project management platform.

### Building the MCP Server

```bash
# Build the MCP package
pnpm --filter @spectree/mcp build
```

### Configuring Claude Code

Add the MCP server to your Claude Code configuration:

**Option 1: Project-level configuration** (`.claude/settings.json` in project root):

```json
{
  "mcpServers": {
    "spectree": {
      "type": "stdio",
      "command": "node",
      "args": ["packages/mcp/dist/index.js"],
      "cwd": "/path/to/SpecTree"
    }
  }
}
```

**Option 2: Global configuration** (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "spectree": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/SpecTree/packages/mcp/dist/index.js"]
    }
  }
}
```

### Verifying MCP Connection

After configuring, restart Claude Code and verify the connection:

1. The MCP server should appear in the list of available tools
2. Test with the built-in `echo` tool: ask Claude to echo a message using the spectree MCP

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
| `spectree__search` | Unified search across features and tasks with all filter options |
| `spectree__list_projects` | List all projects |
| `spectree__get_project` | Get project details |
| `spectree__create_project` | Create a new project |
| `spectree__list_features` | List features with optional filters |
| `spectree__get_feature` | Get feature details |
| `spectree__create_feature` | Create a new feature |
| `spectree__update_feature` | Update a feature |
| `spectree__list_tasks` | List tasks with optional filters |
| `spectree__get_task` | Get task details |
| `spectree__create_task` | Create a new task |
| `spectree__update_task` | Update a task |
| `spectree__list_statuses` | List available statuses |

### Search Tool (`spectree__search`)

The search tool provides powerful filtering capabilities for AI assistants:

```
Parameters:
  query         - Text search in title/description
  project       - Filter by project name or ID
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

## Azure SQL Connection

### Local Development (Docker)

Local development uses Azure SQL Edge in Docker, which runs natively on Apple Silicon (M1/M2/M3):

```bash
# Start the database
pnpm docker:up

# Connection details
Server: localhost
Port: 1433
Database: spectree
Username: sa
Password: LocalDev@Password123
```

### Connecting to Azure SQL (Production/Staging)

Azure SQL databases use private endpoints and are not publicly accessible. Choose one of these methods:

#### Option 1: Temporary Firewall Rule (Quick Testing)

⚠️ **Warning**: This temporarily exposes the database to the internet.

```bash
# Add your IP to the firewall
./infra/scripts/add-dev-firewall.sh add

# Connect using Azure Data Studio, SSMS, or sqlcmd
# Server: sql-spectree-dev.database.windows.net
# Authentication: Azure Active Directory - Universal with MFA

# Remove the firewall rule when done
./infra/scripts/add-dev-firewall.sh remove
```

#### Option 2: VPN Gateway (Recommended for Regular Access)

1. Set up Azure VPN Gateway with point-to-site configuration
2. Connect to the VPN
3. Access SQL Server via private IP

#### Option 3: Azure Bastion / Jump Box

1. Deploy a jump box VM in the VNet
2. Connect via Azure Bastion
3. Access SQL Server from within the VNet

### Connection Strings

**Local Development:**
```
Server=tcp:localhost,1433;Initial Catalog=spectree;User ID=sa;Password=LocalDev@Password123;TrustServerCertificate=True;
```

**Azure (SQL Authentication):**
```
Server=tcp:<server>.database.windows.net,1433;Initial Catalog=<database>;User ID=<user>;Password=<password>;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;
```

**Azure (Managed Identity):**
```
Server=tcp:<server>.database.windows.net,1433;Initial Catalog=<database>;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;Authentication=Active Directory Default;
```

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

#### Docker: SQL Server won't start

**Symptoms**: Container exits immediately or health check fails

**Solutions**:
1. Ensure Docker has enough memory (4GB+ recommended)
2. Check if port 1433 is already in use: `lsof -i :1433`
3. View logs: `docker-compose logs sqlserver`
4. Reset the database: `./scripts/local-dev.sh reset`

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

#### Database connection refused

**Symptoms**: `ECONNREFUSED` or connection timeout

**Solutions**:
1. Verify database is running: `docker-compose ps`
2. Wait for initialization: `docker-compose logs sqlserver-init`
3. Check connection details match `.env` file
4. Restart database: `pnpm docker:down && pnpm docker:up`

#### MCP server not appearing in Claude Code

**Symptoms**: Tools not available after configuration

**Solutions**:
1. Verify MCP server is built: `pnpm --filter @spectree/mcp build`
2. Check configuration path is correct and absolute
3. Restart Claude Code completely
4. Check Claude Code logs for connection errors

#### Azure deployment fails

**Symptoms**: Bicep deployment error

**Solutions**:
1. Verify Azure CLI login: `az account show`
2. Check subscription permissions
3. Run validation: `./deploy.sh -e dev --validate`
4. Review error details in Azure Portal → Deployments

### Getting Help

- Check existing issues in the repository
- Review logs: `pnpm docker:logs` for database, browser console for frontend
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
| **Database** | SQL Server (Azure SQL Edge locally) |
| **ORM** | Prisma |
| **Testing** | Vitest |
| **Linting** | ESLint 9 (flat config) |
| **Formatting** | Prettier |
| **Infrastructure** | Azure (Bicep) |
