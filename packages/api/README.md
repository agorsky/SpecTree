# @spectree/api

SpecTree API backend server - A Fastify-based REST API for managing epics, features, tasks, and project planning workflows.

## Overview

The SpecTree API provides a REST API for project management operations. It uses:
- **Fastify** - High-performance web framework
- **Prisma** - Type-safe ORM with SQLite database
- **JWT** - Token-based authentication
- **TypeScript** - Full type safety

## Prerequisites

- **Node.js 18+** - Required to run the server
- **pnpm** - Package manager (or npm/yarn)

## Installation

From the repository root:

```bash
pnpm install
```

## Setup

### 1. Environment Configuration

Copy the example environment file:

```bash
cd packages/api
cp .env.example .env
```

Edit `.env` to configure your environment:

```env
# Server Configuration
PORT=3001
HOST=0.0.0.0
NODE_ENV=development

# CORS (for web client)
CORS_ORIGIN=http://localhost:5173

# Database (SQLite)
DATABASE_URL="file:./data/spectree.db"

# JWT Secret (change in production!)
JWT_SECRET=your-super-secret-jwt-key-change-in-production
```

### 2. Database Setup

Initialize the database schema:

```bash
npx prisma db push
npx prisma generate
```

> **⚠️ IMPORTANT:** NEVER use `prisma migrate dev` or `prisma migrate reset` as these commands will wipe all data. Use `npx prisma db push` for schema changes.

### 3. Seed Initial Data (Optional)

If you have a seed script:

```bash
pnpm run seed
```

## Development

Start the development server with hot reload:

```bash
pnpm run dev
```

The API will be available at `http://localhost:3001`.

## Building

Compile TypeScript to JavaScript:

```bash
pnpm run build
```

This will:
1. Generate Prisma client
2. Compile TypeScript
3. Copy generated files to `dist/`

## Testing

Run all tests:

```bash
pnpm test
```

Run tests in watch mode:

```bash
pnpm test:watch
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3001` | Server port |
| `HOST` | No | `0.0.0.0` | Server host |
| `NODE_ENV` | No | `development` | Environment (development/production) |
| `CORS_ORIGIN` | No | `http://localhost:5173` | Allowed CORS origin |
| `DATABASE_URL` | **Yes** | – | Prisma database connection string |
| `JWT_SECRET` | **Yes** | – | Secret key for JWT token signing |

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login and get JWT
- `POST /api/v1/auth/logout` - Logout

### API Tokens
- `GET /api/v1/tokens` - List user's API tokens
- `POST /api/v1/tokens` - Create new API token
- `DELETE /api/v1/tokens/:id` - Revoke API token

### Epics
- `GET /api/v1/epics` - List epics
- `GET /api/v1/epics/:id` - Get epic by ID
- `POST /api/v1/epics` - Create epic
- `PATCH /api/v1/epics/:id` - Update epic
- `DELETE /api/v1/epics/:id` - Delete epic

### Features
- `GET /api/v1/features` - List features
- `GET /api/v1/features/:id` - Get feature by ID
- `POST /api/v1/features` - Create feature
- `PATCH /api/v1/features/:id` - Update feature
- `DELETE /api/v1/features/:id` - Delete feature

### Tasks
- `GET /api/v1/tasks` - List tasks
- `GET /api/v1/tasks/:id` - Get task by ID
- `POST /api/v1/tasks` - Create task
- `PATCH /api/v1/tasks/:id` - Update task
- `DELETE /api/v1/tasks/:id` - Delete task

### Skill Packs
- `GET /api/v1/skill-packs` - List available packs
- `GET /api/v1/skill-packs/:name` - Get pack by name
- `POST /api/v1/skill-packs` - Publish pack (requires auth)

See the [API documentation](../../docs/api/) for complete endpoint reference.

## Database Schema

The API uses Prisma with SQLite. The schema is defined in `prisma/schema.prisma`.

Key models:
- **User** - User accounts
- **Team** - Team/organization
- **Epic** - Top-level project container
- **Feature** - Work item (issue)
- **Task** - Sub-issue under a feature
- **Status** - Workflow status
- **APIToken** - Long-lived API tokens

### Database Connection String

SQLite (default):
```
DATABASE_URL="file:./data/spectree.db"
```

PostgreSQL (for production):
```
DATABASE_URL="postgresql://user:password@localhost:5432/spectree?schema=public"
```

### Schema Changes

To apply schema changes without data loss:

```bash
npx prisma db push
npx prisma generate
```

## Security

### JWT Tokens
- Short-lived tokens for user sessions
- Automatically expire (default: 7 days)
- Validated on every authenticated request

### API Tokens
- Long-lived tokens for programmatic access
- Prefix: `st_` followed by random characters
- Can be revoked via API or web UI
- Used by MCP server and CLI

### Rate Limiting
The API includes rate limiting to prevent abuse:
- Global: 100 requests per minute per IP
- Auth endpoints: 5 requests per minute per IP

## Project Structure

```
packages/api/
├── src/
│   ├── index.ts              # Server entry point
│   ├── lib/
│   │   ├── db.ts             # Prisma client
│   │   └── secrets/          # Secrets management
│   ├── routes/               # API route handlers
│   │   ├── auth.ts           # Authentication
│   │   ├── epics.ts          # Epic management
│   │   ├── features.ts       # Feature management
│   │   ├── tasks.ts          # Task management
│   │   └── ...
│   ├── middleware/           # Request middleware
│   ├── errors/               # Error classes
│   ├── utils/                # Utility functions
│   └── events/               # Event handlers
├── prisma/
│   └── schema.prisma         # Database schema
├── tests/                    # Test files
├── .env.example              # Example environment file
├── package.json
└── tsconfig.json
```

## Docker Support

Build Docker image:

```bash
docker build -t spectree-api -f packages/api/Dockerfile .
```

Run with Docker:

```bash
docker run -p 3001:3001 \
  -e DATABASE_URL="file:./data/spectree.db" \
  -e JWT_SECRET="your-secret-here" \
  spectree-api
```

## Troubleshooting

### "Cannot connect to database"

**Cause:** Database file doesn't exist or `DATABASE_URL` is incorrect.

**Solution:**
1. Verify `DATABASE_URL` in `.env`
2. Run `npx prisma db push` to create the database
3. Check file permissions on the data directory

### "JWT_SECRET environment variable is required"

**Cause:** Missing JWT secret configuration.

**Solution:**
1. Copy `.env.example` to `.env`
2. Set a strong random string for `JWT_SECRET`
3. Restart the server

### "Port 3001 already in use"

**Cause:** Another process is using port 3001.

**Solution:**
1. Change `PORT` in `.env` to a different port
2. Or stop the conflicting process

### Schema changes not reflected

**Cause:** Prisma client needs regeneration.

**Solution:**
```bash
npx prisma generate
pnpm run build
```

## Related Documentation

- [MCP Server](../mcp/README.md) - Model Context Protocol server
- [CLI](../cli/README.md) - Command-line interface
- [API Documentation](../../docs/api/) - Full API reference

## License

This package is part of the SpecTree project.
