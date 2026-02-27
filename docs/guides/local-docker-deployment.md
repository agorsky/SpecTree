# Local Docker Deployment Guide

Complete reference for setting up, configuring, and using Dispatcher's local Docker deployment. This guide targets both human developers and AI agents who need to understand the full system.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Artifacts Reference](#artifacts-reference)
  - [Dockerfile.local](#dockerfilelocal)
  - [tsconfig.docker.json](#tsconfigdockerjson)
  - [docker-entrypoint-local.sh](#docker-entrypoint-localsh)
  - [docker-compose.local.yml](#docker-composelocalyml)
- [Configuration](#configuration)
  - [Environment Variables](#environment-variables)
  - [Ports](#ports)
  - [Volumes](#volumes)
- [First Boot & Seeding](#first-boot--seeding)
- [Data Persistence & Reset](#data-persistence--reset)
- [Convenience Scripts](#convenience-scripts)
- [Connecting the MCP Server](#connecting-the-mcp-server)
- [Customization](#customization)
  - [Changing Ports](#changing-ports)
  - [Adding Environment Variables](#adding-environment-variables)
  - [Rebuilding a Single Service](#rebuilding-a-single-service)
- [How It Works (Deep Dive)](#how-it-works-deep-dive)
  - [Build Pipeline](#build-pipeline)
  - [Entrypoint Lifecycle](#entrypoint-lifecycle)
  - [Health Check Flow](#health-check-flow)
  - [Relationship to Azure Artifacts](#relationship-to-azure-artifacts)
- [Troubleshooting](#troubleshooting)
- [Useful Commands](#useful-commands)

---

## Overview

The local Docker deployment provides a **fully self-contained** Dispatcher instance using:

- **SQLite** as the database (single file, no external server)
- **Two containers**: API (Node.js/Fastify) and Web (nginx serving React)
- **Automatic schema initialization and seeding** on first boot
- **Named Docker volume** for data persistence across restarts

A colleague can clone the repo and have a working instance in **under 2 minutes** (post-build) with zero configuration.

### What's Included

| File | Location | Purpose |
|------|----------|---------|
| `Dockerfile.local` | `packages/api/` | Multi-stage API build with SQLite Prisma client |
| `tsconfig.docker.json` | `packages/api/` | TypeScript config that compiles seed scripts for Docker |
| `docker-entrypoint-local.sh` | `packages/api/` | Startup script: schema push → seed → serve |
| `docker-compose.local.yml` | repo root | Orchestrates API + Web with health checks and volumes |

### What's NOT Modified

The local Docker deployment creates **parallel artifacts** — it does not touch:

- `packages/api/Dockerfile` — default Dockerfile
- `packages/api/Dockerfile.azure` — Azure/SQL Server production build
- `packages/api/tsconfig.json` — standard API TypeScript config
- `docker-compose.yml` — existing compose with profile-based setup

---

## Architecture

```
                        Host Machine
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   Browser ──▶ http://localhost                          │
│                                                         │
│   MCP Server ──▶ http://localhost:3001  (runs on host)  │
│                                                         │
└───────────────────────┬─────────────────────────────────┘
                        │ Docker Network
┌───────────────────────┼─────────────────────────────────┐
│                       │                                 │
│   ┌───────────────────▼───────────┐                     │
│   │  Web Container (nginx)        │                     │
│   │  - Serves React static build  │                     │
│   │  - Port 80 → host:80         │                     │
│   │  - Proxies /api → api:3001   │                     │
│   │  - depends_on: api (healthy) │                     │
│   └───────────────┬───────────────┘                     │
│                   │ Docker DNS: http://api:3001          │
│   ┌───────────────▼───────────────┐                     │
│   │  API Container (Node.js)      │                     │
│   │  - Fastify REST API           │                     │
│   │  - Port 3001 → host:3001    │                     │
│   │  - SQLite via Prisma ORM      │                     │
│   │  - Health: /api/health        │                     │
│   └───────────────┬───────────────┘                     │
│                   │                                     │
│   ┌───────────────▼───────────────┐                     │
│   │  Named Volume: dispatcher-data  │                     │
│   │  Mounted at /app/data/        │                     │
│   │  - dispatcher.db (SQLite)       │                     │
│   │  - .seeded (sentinel file)    │                     │
│   └───────────────────────────────┘                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Key relationships:**

- The **web nginx.conf** (`packages/web/nginx.conf`) proxies `/api` requests to `http://api:3001` using Docker's internal DNS — no extra configuration needed.
- The **MCP server** runs on the host machine (not in Docker) and connects to the API at `http://localhost:3001`.
- The **SQLite database** lives on a Docker named volume so it survives container restarts but is wiped on `docker-compose down -v`.

---

## Prerequisites

| Requirement | Details |
|---|---|
| **Docker Desktop** | Installed and **running** — [Get Docker Desktop](https://www.docker.com/products/docker-desktop/) |
| **Git** | To clone the repository |
| **~2 GB disk** | For Docker images (first build) |
| **Ports 80 and 3001** | Must be free on your machine |

> **Node.js and pnpm are NOT required** to run Dispatcher in Docker. You only need them for the convenience scripts (`pnpm docker:local:*`) or to run the MCP server on the host.

---

## Quick Start

```bash
# 1. Clone the repository
git clone <repo-url>
cd Dispatcher

# 2. Build and start everything
docker-compose -f docker-compose.local.yml up -d --build

# 3. Wait ~60 seconds for first-boot setup, then open:
open http://localhost
```

**Default credentials:**

| Field | Value |
|---|---|
| Email | `admin@dispatcher.dev` |
| Password | `Password123!` |

---

## Artifacts Reference

### Dockerfile.local

**Location:** `packages/api/Dockerfile.local`

Multi-stage Docker build for the API with SQLite support.

**Stage 1 — Builder:**
1. Installs native build tools (`python3`, `make`, `g++`) required for `bcrypt`
2. Runs `pnpm install --frozen-lockfile` for all dependencies
3. Builds the `@dispatcher/shared` package first (API depends on it)
4. Generates the **SQLite** Prisma client from `prisma/schema.prisma` (NOT `schema.sqlserver.prisma`)
5. Compiles TypeScript using `tsconfig.docker.json` (includes seed scripts)
6. Copies the generated Prisma client into the `dist/` output

**Stage 2 — Runner:**
1. Copies compiled output, Prisma schema, and package files from builder
2. Installs production-only dependencies (includes native `bcrypt` rebuild)
3. Removes build tools (`python3`, `make`, `g++`) to reduce image size
4. Copies and makes the entrypoint script executable
5. Creates the `/app/data` directory for the SQLite volume mount
6. Sets the entrypoint to `docker-entrypoint-local.sh`

**Key difference from `Dockerfile.azure`:** Uses `schema.prisma` (SQLite) instead of `schema.sqlserver.prisma` (SQL Server), and compiles with `tsconfig.docker.json` to include seed scripts in the build output.

### tsconfig.docker.json

**Location:** `packages/api/tsconfig.docker.json`

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "."
  },
  "include": ["src/**/*.ts", "prisma/**/*.ts"],
  "exclude": ["node_modules", "dist", "src/generated"]
}
```

**Why this exists:** The standard `tsconfig.json` has `rootDir: "./src"` and only includes `src/**/*`, so seed files in `prisma/` aren't compiled. This config changes `rootDir` to `.` and adds `prisma/**/*.ts` to include.

**Output structure impact:** When `rootDir` changes from `./src` to `.`, the directory hierarchy in `dist/` shifts:

| Source File | Standard tsconfig (`rootDir: ./src`) | Docker tsconfig (`rootDir: .`) |
|---|---|---|
| `src/index.ts` | `dist/index.js` | `dist/src/index.js` |
| `prisma/seed.ts` | _(not compiled)_ | `dist/prisma/seed.js` |
| `prisma/built-in-templates.ts` | _(not compiled)_ | `dist/prisma/built-in-templates.js` |

This is why the entrypoint and Dockerfile reference `dist/src/index.js` and `dist/prisma/seed.js`.

### docker-entrypoint-local.sh

**Location:** `packages/api/docker-entrypoint-local.sh`

Bash script that runs on every container start:

```
1. mkdir -p /app/data        # Ensure volume mount point exists
2. export DATABASE_URL=...   # Set to file:/app/data/dispatcher.db
3. prisma db push            # Idempotent schema sync (safe every time)
4. if [ ! -f .seeded ]       # First-boot check
     → node seed.js          #   Run seed script
     → touch .seeded          #   Mark as seeded
5. exec node dist/src/index.js  # Start API (replaces shell for signal handling)
```

**Important flags for `prisma db push`:**
- `--skip-generate` — Prisma client was already generated at build time
- `--accept-data-loss` — Allows flexibility for schema changes in development
- `--schema=prisma/schema.prisma` — Explicitly uses the SQLite schema

**Sentinel file:** `/app/data/.seeded` lives on the Docker volume. It persists across container restarts but is deleted when the volume is removed (`docker-compose down -v`), triggering a fresh seed on next start.

**Signal handling:** `exec node` replaces the shell process with Node.js so that `SIGTERM` and `SIGINT` from Docker are delivered directly to the API process for graceful shutdown.

**Line endings:** This file **must** use LF line endings (not CRLF). If edited on Windows, ensure your editor or Git config preserves LF.

### docker-compose.local.yml

**Location:** repo root

Two services with no profile flags — `docker-compose up` starts everything:

**`api` service:**
- Builds from `packages/api/Dockerfile.local` with repo root as build context
- Exposes port `3001` to host
- Health check: `wget --spider -q http://localhost:3001/api/health` every 10s
- Named volume `dispatcher-data` mounted at `/app/data`
- `start_period: 30s` allows time for schema push and seeding before health checks begin
- Restart policy: `unless-stopped`

**`web` service:**
- Builds from `packages/web/Dockerfile` (existing, no modifications)
- Exposes port `80` to host
- `depends_on: api` with `condition: service_healthy` — won't start until API is ready
- Restart policy: `unless-stopped`

**`dispatcher-data` volume:**
- Docker named volume that persists SQLite database and sentinel file
- Survives `docker-compose down` and `docker-compose restart`
- Removed only by `docker-compose down -v`

---

## Configuration

### Environment Variables

Set in `docker-compose.local.yml` under the `api` service:

| Variable | Default Value | Description |
|---|---|---|
| `NODE_ENV` | `production` | Runtime mode |
| `PORT` | `3001` | API listen port |
| `HOST` | `0.0.0.0` | API bind address (all interfaces for Docker) |
| `DATABASE_URL` | `file:/app/data/dispatcher.db` | SQLite database location on the volume |
| `JWT_SECRET` | `local-dev-jwt-secret-change-in-production` | JWT signing secret (fine for local use) |
| `CORS_ORIGIN` | `http://localhost` | Allowed CORS origin (no port — web runs on 80) |

> **Note:** `CORS_ORIGIN` must be `http://localhost` (without `:80`) because browsers don't include the default port in the `Origin` header.

### Ports

| Host Port | Container Port | Service | Protocol |
|---|---|---|---|
| `80` | `80` | Web (nginx) | HTTP |
| `3001` | `3001` | API (Node.js) | HTTP |

### Volumes

| Volume Name | Mount Path | Contents |
|---|---|---|
| `dispatcher-data` | `/app/data/` | `dispatcher.db` (SQLite) + `.seeded` (sentinel) |

---

## First Boot & Seeding

On the very first start (or after `down -v`), the entrypoint:

1. **Creates tables** — `prisma db push` applies the full SQLite schema
2. **Seeds data** — The compiled seed script (`dist/prisma/seed.js`) creates:

| Entity | Details |
|---|---|
| **Admin user** | `admin@dispatcher.dev` / `Password123!` (global admin) |
| **Engineering team** | Key: `ENG`, with admin membership for the admin user |
| **Workflow statuses** | Backlog, Todo, In Progress, Done, Canceled (for team and personal scope) |
| **Personal scope** | Private workspace for the admin user |
| **Personal projects** | "Side Project Ideas" and "Learning Goals 2026" with sample features |
| **Plan templates** | Built-in templates: Code Feature, Bug Fix, Refactoring, API Endpoint |
| **Health checks** | API Server and Database Connection records |

3. **Writes sentinel** — Creates `/app/data/.seeded` to skip seeding on future restarts

On **subsequent starts**, `prisma db push` still runs (idempotent, harmless), but seeding is skipped.

---

## Data Persistence & Reset

| Scenario | Command | Data Preserved? |
|---|---|---|
| Stop containers | `docker-compose -f docker-compose.local.yml down` | ✅ Yes |
| Restart containers | `docker-compose -f docker-compose.local.yml restart` | ✅ Yes |
| Rebuild and restart | `docker-compose -f docker-compose.local.yml up -d --build` | ✅ Yes |
| **Full reset (wipe all data)** | `docker-compose -f docker-compose.local.yml down -v` | ❌ No — re-seeds on next start |

After a reset, the next `up -d --build` triggers a fresh schema push and seed automatically.

---

## Convenience Scripts

If you have Node.js and pnpm installed, use these from the repo root:

| Command | Equivalent | Description |
|---|---|---|
| `pnpm docker:local:up` | `docker-compose -f docker-compose.local.yml up -d --build` | Build and start containers |
| `pnpm docker:local:down` | `docker-compose -f docker-compose.local.yml down` | Stop containers (preserves data) |
| `pnpm docker:local:logs` | `docker-compose -f docker-compose.local.yml logs -f` | Tail logs from all services |
| `pnpm docker:local:reset` | `docker-compose -f docker-compose.local.yml down -v` | Stop and **delete all data** |

---

## Connecting the MCP Server

The MCP server runs on the **host machine** (not inside Docker) and connects to the Dockerized API at `localhost:3001`.

### Prerequisites

- Node.js 20+ installed on the host
- The API container must be running and healthy

### Option 1: Direct Run

```bash
# From the Dispatcher repo root
pnpm --filter @dispatcher/mcp build
API_TOKEN="st_your_token_here" API_BASE_URL="http://localhost:3001" node packages/mcp/dist/index.js
```

### Option 2: Configure in AI Tool Settings

For Claude Code, GitHub Copilot, or other MCP-compatible tools:

```json
{
  "mcpServers": {
    "dispatcher": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/Dispatcher/packages/mcp/dist/index.js"],
      "env": {
        "API_TOKEN": "st_your_token_here",
        "API_BASE_URL": "http://localhost:3001"
      }
    }
  }
}
```

### Getting an API Token

1. Log in to the Web UI at `http://localhost`
2. Navigate to Settings → API Tokens
3. Create a token (it will start with `st_`)

Or via the API:

```bash
# 1. Get a JWT
JWT=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@dispatcher.dev","password":"Password123!"}' | jq -r '.accessToken')

# 2. Create an API token
curl -X POST http://localhost:3001/api/v1/tokens \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"name":"MCP Local"}'
```

---

## Customization

### Changing Ports

Edit `docker-compose.local.yml`:

```yaml
# Change web from port 80 to 8080
web:
  ports:
    - "8080:80"

# Change API from port 3001 to 3002
api:
  ports:
    - "3002:3001"
  environment:
    - CORS_ORIGIN=http://localhost:8080  # Update if web port changed
```

If you change the API host port, update MCP config's `API_BASE_URL` accordingly.

### Adding Environment Variables

Add entries under `api.environment` in `docker-compose.local.yml`:

```yaml
api:
  environment:
    - MY_CUSTOM_VAR=value
```

### Rebuilding a Single Service

```bash
# Rebuild just the API (e.g., after code changes)
docker-compose -f docker-compose.local.yml up -d --build api

# Rebuild just the web frontend
docker-compose -f docker-compose.local.yml up -d --build web
```

---

## How It Works (Deep Dive)

### Build Pipeline

```
Source                      Builder Stage                    Runner Stage
──────                      ─────────────                    ────────────
package.json ──────────┐
pnpm-lock.yaml ────────┤
pnpm-workspace.yaml ───┤
packages/shared/ ──────┼──▶ pnpm install ──────────────┐
packages/api/ ─────────┘    pnpm shared build          │
                            prisma generate (SQLite)   │
                            tsc -p tsconfig.docker.json│
                            cp generated → dist/       │
                                                       ▼
                                               dist/src/index.js
                                               dist/prisma/seed.js
                                               dist/src/generated/prisma/
                                               prisma/schema.prisma
                                                       │
                                                       ▼
                                               pnpm install --prod
                                               (rebuilds bcrypt native)
                                               apk del build tools
                                               chmod entrypoint
                                                       │
                                                       ▼
                                               ENTRYPOINT [entrypoint.sh]
```

### Entrypoint Lifecycle

```
Container Start
     │
     ▼
mkdir -p /app/data          ← Ensure volume mount exists
     │
     ▼
export DATABASE_URL=...     ← Point Prisma at the volume
     │
     ▼
prisma db push              ← Create/sync all tables (idempotent)
     │
     ▼
/.seeded exists? ──yes──▶ Skip seeding
     │ no
     ▼
node dist/prisma/seed.js    ← Create admin, team, statuses, templates
     │
     ▼
touch /app/data/.seeded     ← Mark as seeded
     │
     ▼
exec node dist/src/index.js ← API server starts (PID 1)
```

### Health Check Flow

```
docker-compose up
     │
     ├── api container starts
     │   ├── entrypoint: schema push (~5s)
     │   ├── entrypoint: seed (~10s, first boot only)
     │   ├── entrypoint: node starts API
     │   └── health check: wget /api/health
     │       ├── start_period: 30s (grace period)
     │       ├── interval: 10s
     │       ├── retries: 5
     │       └── timeout: 5s
     │
     └── web container waits (depends_on: service_healthy)
         └── starts nginx once api is healthy
```

The `start_period: 30s` is critical — it gives the entrypoint enough time to run schema push and seeding before Docker starts counting health check failures.

### Relationship to Azure Artifacts

| Aspect | Local (`*.local`) | Azure |
|---|---|---|
| Dockerfile | `Dockerfile.local` | `Dockerfile.azure` |
| Database | SQLite (`schema.prisma`) | SQL Server (`schema.sqlserver.prisma`) |
| TypeScript config | `tsconfig.docker.json` (includes seeds) | `tsconfig.json` (src only) |
| Entrypoint | `docker-entrypoint-local.sh` | Container Apps startup command |
| Compose | `docker-compose.local.yml` | `docker-compose.yml` (profile-based) |
| Seeding | Automatic via entrypoint | Manual or pipeline-driven |
| Output paths | `dist/src/index.js` | `dist/index.js` |

**Zero overlap** — local artifacts never modify Azure files and vice versa.

---

## Troubleshooting

### Port 80 already in use

Another process (Apache, IIS, another container) is using port 80.

```bash
# Find what's on port 80
lsof -i :80          # macOS/Linux
netstat -ano | findstr :80  # Windows

# Fix: Change the web port in docker-compose.local.yml
# ports:
#   - "8080:80"    # Access via http://localhost:8080
```

### Port 3001 already in use

If you're running the API in dev mode (`pnpm dev`), it also binds port 3001. Stop the dev server or change the Docker port mapping.

### Slow first build (2–5 minutes)

The first build downloads base images and installs all dependencies. Subsequent rebuilds use Docker layer caching and are much faster (~30s for code-only changes).

### 502 Bad Gateway on first load

The web container starts immediately, but the API needs 15–30 seconds for schema push and seeding. Nginx returns a 502 until the API health check passes.

**Fix:** Wait 30 seconds and refresh. Watch progress with:

```bash
docker-compose -f docker-compose.local.yml logs -f api
```

Look for `Starting Dispatcher API...` — once you see that, the UI is ready.

### Seed failures

If seeding fails (e.g., interrupted first boot), the sentinel file won't exist and seeding retries on the next start. For persistent errors:

```bash
# Full reset — wipes data and re-seeds from scratch
docker-compose -f docker-compose.local.yml down -v
docker-compose -f docker-compose.local.yml up -d --build
```

### bcrypt build errors

If you see errors related to `bcrypt` during the Docker build, ensure Docker Desktop has enough memory (at least 4 GB). The Alpine native build of bcrypt requires `python3`, `make`, and `g++`, which are installed automatically by the Dockerfile.

### CRLF line ending issues

If the entrypoint script fails with `/bin/bash^M: bad interpreter`, the file has Windows-style line endings. Fix with:

```bash
# On the host (requires dos2unix or sed)
sed -i 's/\r$//' packages/api/docker-entrypoint-local.sh

# Or configure Git to preserve LF
git config core.autocrlf input
```

### WSL2 tips (Windows)

- Ensure Docker Desktop uses the **WSL 2 backend**
- Run commands from a WSL2 terminal for best performance
- If `localhost` doesn't resolve, try `127.0.0.1`
- Best performance when the repo lives in the WSL2 filesystem (`/home/...`), not on a mounted Windows drive (`/mnt/c/...`)

### Container won't start after code changes

If you've modified source code, you need to rebuild:

```bash
docker-compose -f docker-compose.local.yml up -d --build
```

Without `--build`, Docker reuses the existing image.

---

## Useful Commands

```bash
# View container status
docker-compose -f docker-compose.local.yml ps

# Follow logs (all services)
docker-compose -f docker-compose.local.yml logs -f

# Follow logs (API only)
docker-compose -f docker-compose.local.yml logs -f api

# Open a shell in the API container
docker-compose -f docker-compose.local.yml exec api sh

# Inspect the SQLite database via Prisma Studio
docker-compose -f docker-compose.local.yml exec api npx prisma studio

# Restart just the API (e.g., after config change)
docker-compose -f docker-compose.local.yml restart api

# Rebuild a single service
docker-compose -f docker-compose.local.yml up -d --build api

# Check disk usage of Docker volumes
docker system df -v | grep dispatcher

# Inspect the named volume
docker volume inspect dispatcher_dispatcher-data
```
