# SpecTree Complete Setup & Run Guide

A comprehensive walkthrough for setting up, running, and accessing the SpecTree project management platform.

---

## 🚀 Quick Restart (After Reboot)

**Already have everything installed? Just restarted your computer? Run these commands:**

```bash
# 1. Navigate to project
cd /path/to/SpecTree

# 2. Start the app
pnpm dev
```

**That's it!** Access the app at:
- **Web App**: http://localhost:5173
- **API**: http://localhost:3001

**First time or database was reset?** Initialize and seed the database:
```bash
pnpm --filter @spectree/api db:push
pnpm --filter @spectree/api db:seed
```

**Login credentials:**
| Email | Password |
|-------|----------|
| `admin@spectree.dev` | `Password123!` |
| `developer@spectree.dev` | `Password123!` |
| `guest@spectree.dev` | `Password123!` |

<details>
<summary><strong>⚠️ Having issues? Quick troubleshooting</strong></summary>

| Problem | Solution |
|---------|----------|
| Database not found | Run `pnpm --filter @spectree/api db:push` |
| "Cannot find module" errors | Run `pnpm build` first |
| Prisma client errors | Run `pnpm --filter @spectree/api db:generate` |

</details>

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites Checklist](#prerequisites-checklist)
3. [Step-by-Step Setup](#step-by-step-setup)
4. [Running the Application](#running-the-application)
5. [Accessing the Application](#accessing-the-application)
6. [Package Details](#package-details)
7. [Database Setup & Management](#database-setup--management)
8. [MCP Server Integration](#mcp-server-integration)
9. [Common Issues & Solutions](#common-issues--solutions)
10. [Production Deployment](#production-deployment)

---

## Overview

SpecTree is a monorepo containing four packages:

| Package | Description | Port |
|---------|-------------|------|
| `@spectree/api` | Fastify REST API backend | 3001 |
| `@spectree/web` | React + Vite frontend | 5173 |
| `@spectree/mcp` | Model Context Protocol server for AI integration | N/A (stdio) |
| `@spectree/shared` | Shared TypeScript types and utilities | N/A (library) |

**Architecture:**
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   React Web     │────▶│   Fastify API   │────▶│     SQLite      │
│   (Port 5173)   │     │   (Port 3001)   │     │   (File-based)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │   MCP Server    │
                        │   (AI Agents)   │
                        └─────────────────┘
```

---

## Prerequisites Checklist

Before starting, ensure you have these installed:

### Required Tools

| Tool | Minimum Version | Check Command | Install |
|------|-----------------|---------------|---------|
| **Node.js** | 20.0.0+ | `node --version` | [nodejs.org](https://nodejs.org/) or `nvm install 20` |
| **pnpm** | 9.0.0+ | `pnpm --version` | `npm install -g pnpm` or `corepack enable` |

### Optional Tools

| Tool | Purpose | Install |
|------|---------|---------|
| **Docker** | Containerized deployment | [Docker Desktop](https://www.docker.com/products/docker-desktop/) |
| **Azure CLI** | Production deployment | [Install Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli) |
| **Claude Code / AI Agent** | MCP server integration | Per tool instructions |

### System Requirements

- **Disk**: ~2GB free space (node_modules)
- **Ports**: 3001, 5173 must be available

> **Note**: Docker is only needed for containerized deployment. Local development uses SQLite, which requires no separate database server.

---

## Step-by-Step Setup

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd SpecTree
```

### Step 2: Install Dependencies

```bash
pnpm install
```

This installs dependencies for all packages in the monorepo. Expect this to take 1-3 minutes.

### Step 3: Configure Environment Variables

```bash
# Copy the example environment file
cp .env.example .env
```

The default `.env` file is pre-configured for local development:

```bash
# Database Configuration (SQLite)
DATABASE_URL=file:./data/spectree.db

# API Server Configuration
API_PORT=3001
API_HOST=0.0.0.0
CORS_ORIGIN=http://localhost:5173

# Application Settings
NODE_ENV=development
```

### Step 4: Set Up the Database

The database is a SQLite file that's created automatically:

```bash
# Generate Prisma client
pnpm --filter @spectree/api db:generate

# Create database and apply schema
pnpm --filter @spectree/api db:push
```

The database file is created at `packages/api/prisma/data/spectree.db`.

> **Note**: `db:push` is for development. For production, use `db:migrate` to create migrations.

### Step 5: Build All Packages

```bash
pnpm build
```

This builds packages in dependency order:
1. `@spectree/shared` (no dependencies)
2. `@spectree/api` (depends on shared)
3. `@spectree/web` (depends on shared)
4. `@spectree/mcp` (depends on shared & api)

### Step 6: (Optional) Seed the Database

```bash
pnpm --filter @spectree/api db:seed
```

This creates sample data for testing.

---

## Running the Application

### Development Mode (Recommended)

Run all packages in development mode with hot reload:

```bash
pnpm dev
```

This starts:
- **API Server**: http://localhost:3001 (with hot reload via tsx)
- **Web App**: http://localhost:5173 (with Vite HMR)

### Run Individual Packages

```bash
# API only
pnpm --filter @spectree/api dev

# Web only
pnpm --filter @spectree/web dev

# MCP server (watch mode)
pnpm --filter @spectree/mcp dev
```

### Production Mode (Local)

```bash
# Build all packages
pnpm build

# Start API
pnpm --filter @spectree/api start

# In another terminal, preview web build
pnpm --filter @spectree/web preview
```

### Full Docker Stack (Optional)

Run everything in Docker (API, Web):

```bash
docker compose --profile full up -d
```

This exposes:
- **Web App**: http://localhost:80
- **API**: http://localhost:3001

---

## Accessing the Application

### Web Interface

| Environment | URL |
|-------------|-----|
| Development | http://localhost:5173 |
| Docker (full profile) | http://localhost:80 |

### API Endpoints

| Environment | Base URL |
|-------------|----------|
| Development | http://localhost:3001 |
| Docker | http://localhost:3001 |

**Example API calls:**

```bash
# Health check
curl http://localhost:3001/health

# List projects (requires auth in production)
curl http://localhost:3001/api/v1/projects

# Search features
curl "http://localhost:3001/api/v1/features?query=authentication&status=in_progress"
```

### Database Access

**Database Location:**
- File: `packages/api/prisma/data/spectree.db`

**Tools for Database Access:**

1. **Prisma Studio** (built-in GUI):
   ```bash
   pnpm --filter @spectree/api db:studio
   ```
   Opens at http://localhost:5555

2. **SQLite CLI** (if installed):
   ```bash
   sqlite3 packages/api/prisma/data/spectree.db
   ```

---

## Package Details

### @spectree/api (Backend)

**Technology**: Fastify 5, Prisma ORM, SQLite

**Key Scripts:**
```bash
pnpm --filter @spectree/api dev          # Development server
pnpm --filter @spectree/api build        # Build for production
pnpm --filter @spectree/api test         # Run tests
pnpm --filter @spectree/api db:studio    # Database GUI
pnpm --filter @spectree/api db:push      # Sync schema (dev)
pnpm --filter @spectree/api db:migrate   # Create migration
pnpm --filter @spectree/api db:seed      # Seed sample data
```

**API Routes:**
- `GET /health` - Health check
- `GET /api/v1/projects` - List projects
- `GET /api/v1/features` - List features (with search/filter)
- `GET /api/v1/tasks` - List tasks
- `GET /api/v1/statuses` - List workflow statuses
- `GET /api/v1/teams` - List teams
- `GET /api/v1/users` - List users

### @spectree/web (Frontend)

**Technology**: React 19, Vite 6, Tailwind CSS 4, TanStack Query, Zustand

**Key Scripts:**
```bash
pnpm --filter @spectree/web dev          # Development server
pnpm --filter @spectree/web build        # Production build
pnpm --filter @spectree/web preview      # Preview production build
pnpm --filter @spectree/web test         # Run tests
```

### @spectree/mcp (AI Integration)

**Technology**: Model Context Protocol SDK

**Key Scripts:**
```bash
pnpm --filter @spectree/mcp build        # Build MCP server
pnpm --filter @spectree/mcp dev          # Watch mode
pnpm --filter @spectree/mcp start        # Run directly
```

### @spectree/shared (Common Code)

**Contents**: Shared TypeScript types and utilities used by all other packages.

```bash
pnpm --filter @spectree/shared build     # Build library
```

---

## Database Setup & Management

### Schema Overview

The database contains these main tables:

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│   Team   │────▶│  Project │────▶│  Feature │────▶│   Task   │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                                  │               │
     │                                  │               │
     ▼                                  ▼               ▼
┌──────────┐                       ┌──────────┐   ┌──────────┐
│  Status  │◀──────────────────────│  Status  │   │  Status  │
└──────────┘                       └──────────┘   └──────────┘
     │
     ▼
┌──────────┐     ┌────────────┐
│   User   │────▶│ Membership │
└──────────┘     └────────────┘
```

**Models:**
- **Team**: Organization unit (e.g., "Engineering", "Design")
- **User**: User accounts with authentication
- **Membership**: Joins users to teams with roles (admin/member/guest)
- **Project**: Container for features within a team
- **Status**: Workflow states (backlog/unstarted/started/completed/canceled)
- **Feature**: Work items (like GitHub Issues)
- **Task**: Sub-items within features

### Common Database Commands

```bash
# Reset database (delete all data)
rm packages/api/prisma/data/spectree.db
pnpm --filter @spectree/api db:push

# View current schema
pnpm --filter @spectree/api db:studio

# Create a migration after schema changes
pnpm --filter @spectree/api db:migrate --name describe_change

# Deploy migrations (production)
pnpm --filter @spectree/api db:migrate:deploy

# Backup database
./scripts/backup-db.sh

# Restore from backup
./scripts/restore-db.sh ./backups/spectree_YYYYMMDD_HHMMSS.db
```

### Connection String

Prisma uses `DATABASE_URL` environment variable:

```
file:./data/spectree.db
```

---

## MCP Server Integration

The MCP server allows AI agents (like Claude) to interact with SpecTree.

### Setup for Claude Code

1. **Build the MCP server:**
   ```bash
   pnpm --filter @spectree/mcp build
   ```

2. **Configure Claude Code** (`.claude/settings.json` in project root):
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

3. **Restart Claude Code** and verify tools appear.

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `spectree__search` | Search across features and tasks |
| `spectree__list_projects` | List all projects |
| `spectree__get_project` | Get project details |
| `spectree__create_project` | Create a new project |
| `spectree__list_features` | List features with filters |
| `spectree__get_feature` | Get feature details |
| `spectree__create_feature` | Create a new feature |
| `spectree__update_feature` | Update a feature |
| `spectree__list_tasks` | List tasks with filters |
| `spectree__get_task` | Get task details |
| `spectree__create_task` | Create a new task |
| `spectree__update_task` | Update a task |
| `spectree__list_statuses` | List available statuses |

---

## Common Issues & Solutions

### Database file not found

**Symptoms**: Error about missing database file

**Solutions**:
1. Create the database:
   ```bash
   pnpm --filter @spectree/api db:push
   ```
2. Check file exists:
   ```bash
   ls packages/api/prisma/data/spectree.db
   ```

### "ECONNREFUSED" when connecting to API

**Solutions**:
1. Ensure the API server is running:
   ```bash
   pnpm dev
   ```
2. Check port 3001 is not in use:
   ```bash
   lsof -i :3001
   ```

### Prisma: "Schema out of sync"

**Solution**:
```bash
pnpm --filter @spectree/api db:push --force-reset
```

> ⚠️ Warning: This deletes all data. Use only in development.

### TypeScript errors after git pull

**Solution**:
```bash
pnpm build
pnpm --filter @spectree/api db:generate
```

### pnpm install fails

**Solutions**:
1. Clear cache:
   ```bash
   pnpm store prune
   ```
2. Fresh install:
   ```bash
   rm -rf node_modules pnpm-lock.yaml
   pnpm install
   ```

### Port already in use

**Find and kill process**:
```bash
# Find process using port 3001
lsof -i :3001

# Kill by PID
kill -9 <PID>
```

---

## Production Deployment

### Azure Deployment

The project includes Azure infrastructure as code (Bicep).

**Prerequisites:**
```bash
az login
az bicep install
```

**Deploy:**
```bash
cd infra

# Preview changes
./deploy.sh -e dev --what-if

# Deploy to development
./deploy.sh -e dev

# Deploy to production
./deploy.sh -e prod
```

### Environment Variables (Production)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Database connection string |
| `AZURE_KEY_VAULT_URI` | Key Vault URI for secrets |
| `AZURE_CLIENT_ID` | Managed identity client ID |
| `NODE_ENV` | Set to `production` |

### Post-Deployment Steps

1. Create application database user (see `infra/README.md`)
2. Grant Container App access to Key Vault
3. Configure custom domain (if needed)

---

## Quick Reference

### Start Everything (Development)

```bash
# Install dependencies (first time only)
pnpm install

# Create database (first time only)
pnpm --filter @spectree/api db:push

# Build and start
pnpm build
pnpm dev
```

### URLs

| Service | URL |
|---------|-----|
| Web App | http://localhost:5173 |
| API | http://localhost:3001 |
| Prisma Studio | http://localhost:5555 |

### Key Commands

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all dependencies |
| `pnpm build` | Build all packages |
| `pnpm dev` | Start development servers |
| `pnpm docker:up` | Start Docker stack (optional) |
| `pnpm docker:down` | Stop Docker stack |
| `pnpm test` | Run all tests |
| `pnpm lint` | Lint all packages |
| `pnpm format` | Format code |

---

## Getting Help

- Check existing [GitHub Issues](../../issues)
- Review logs: browser console for frontend
- For Azure issues: Check Azure Portal activity logs
- See the main [README.md](../README.md) for additional details
