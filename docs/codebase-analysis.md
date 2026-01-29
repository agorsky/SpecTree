# SpecTree Codebase Analysis

> **Document Purpose**: Deep technical analysis of the SpecTree application architecture, implementation status, and recommendations.
> **Generated**: 2026-01-27
> **Version**: 0.1.0

---

## Executive Summary

SpecTree is a **Project Management & Issue Tracking Platform** designed to provide an alternative to Linear with similar UX patterns while offering MCP (Model Context Protocol) integration for AI assistants. The application follows a modern monorepo architecture using TypeScript across all packages.

### Key Findings

| Aspect | Status | Assessment |
|--------|--------|------------|
| **Architecture** | ✅ Well-designed | Clean monorepo with clear separation of concerns |
| **API** | ✅ Functional | Full CRUD operations with comprehensive routing |
| **Database** | ✅ Complete schema | Prisma ORM with SQL Server support |
| **MCP Server** | ✅ Implemented | AI integration layer with search/ordering tools |
| **Frontend** | ⚠️ Scaffolded | Basic structure in place, needs feature completion |
| **Infrastructure** | ✅ Production-ready | Azure Bicep with security best practices |
| **Documentation** | ✅ Excellent | Comprehensive research docs and API guides |
| **Testing** | ⚠️ Partial | Vitest configured, test coverage needs expansion |

---

## 1. Architecture Overview

### 1.1 Monorepo Structure

```
SpecTree/
├── packages/
│   ├── api/          # Fastify backend (main business logic)
│   ├── web/          # React frontend (Vite + Tailwind + Radix)
│   ├── mcp/          # MCP server for AI agent integration
│   └── shared/       # Shared types and utilities
├── infra/            # Azure infrastructure as code (Bicep)
├── scripts/          # Development and deployment helpers
└── docs/             # Research documentation and design decisions
```

### 1.2 Package Dependency Graph

```
@spectree/shared  ─── Foundation Package (no dependencies)
       │
       ├── @spectree/api     → Depends on shared types
       ├── @spectree/web     → Depends on shared types  
       └── @spectree/mcp     → Depends on shared types (MCP tools)
```

### 1.3 Technology Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Runtime** | Node.js | 20+ | Server runtime |
| **Package Manager** | pnpm | 9+ | Monorepo workspace management |
| **Build System** | Turborepo | 2.3 | Parallel builds with caching |
| **Language** | TypeScript | 5.7 | Type safety across all packages |
| **Backend** | Fastify | 5.x | High-performance REST API |
| **Frontend** | React | 19 | UI framework |
| **Bundler** | Vite | 6.x | Fast dev server and builds |
| **Styling** | Tailwind CSS | 4.x | Utility-first CSS |
| **Components** | Radix UI | Latest | Accessible component primitives |
| **Database** | SQL Server | Azure SQL Edge (local) | Relational data store |
| **ORM** | Prisma | Latest | Type-safe database access |
| **Testing** | Vitest | 2.1 | Fast unit/integration testing |
| **Linting** | ESLint | 9.x | Code quality (flat config) |
| **Formatting** | Prettier | 3.x | Consistent code style |
| **AI Integration** | MCP SDK | Latest | Model Context Protocol server |
| **Infrastructure** | Azure Bicep | Latest | Infrastructure as Code |

---

## 2. Data Model Analysis

### 2.1 Entity Hierarchy

The data model follows a carefully researched hierarchy inspired by Linear:

```
Team (Workspace container)
  └── Project (Work organization)
       └── Feature (Primary work items - equiv. to Linear Issues)
            └── Task (Sub-tasks - equiv. to Linear Sub-Issues)
```

### 2.2 Core Entities

#### Team
- **Purpose**: Top-level organization unit (e.g., "Commercial", "Engineering")
- **Key Fields**: `id`, `name`, `key` (unique slug like "COM"), `color`, `icon`
- **Design Decision**: Teams scope all other entities; users access teams via memberships

#### User
- **Purpose**: Authentication identity and work assignment
- **Key Fields**: `id`, `email`, `name`, `passwordHash`, `avatarUrl`, `isActive`
- **Security**: Password hashing implemented at application layer

#### Membership
- **Purpose**: Many-to-many relationship between Users and Teams with RBAC
- **Roles**: `admin`, `member`, `guest`
- **Design**: Enables users to belong to multiple teams with different permissions

#### Project
- **Purpose**: Container for related Features within a Team
- **Key Fields**: `id`, `name`, `description`, `sortOrder`, `color`, `icon`
- **Constraint**: Projects belong to exactly one Team

#### Status
- **Purpose**: Workflow states for Features and Tasks
- **Categories**: `backlog`, `unstarted`, `started`, `completed`, `canceled`
- **Scope**: Team-level (each team has its own status set)
- **Design Decision**: Aligns with Linear's 5-category system for sync compatibility

#### Feature
- **Purpose**: Primary work item (equivalent to Linear "Issue")
- **Key Fields**: `id`, `identifier` (e.g., "COM-123"), `title`, `description`, `sortOrder`
- **Relations**: Belongs to Project, has Status, assigned to User, contains Tasks

#### Task
- **Purpose**: Sub-item of Feature (equivalent to Linear "Sub-Issue")
- **Key Fields**: Same structure as Feature
- **Constraint**: Cannot have children (2-level max hierarchy enforced)

### 2.3 Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| 2-level hierarchy limit | Prevents complexity; Linear allows unlimited but rarely used |
| Team-scoped statuses | Allows workflow customization per team |
| Float-based `sortOrder` | Enables drag-drop reordering without renumbering |
| Identifier format (`KEY-N`) | Human-readable, matches Linear convention |
| Soft delete via `isArchived` | Preserves data for audit/recovery |

---

## 3. API Layer Analysis

### 3.1 Framework Choice

The API uses **Fastify** (not Express as some Linear tickets specified). This was a deliberate architectural decision documented in `docs/research-express-vs-fastify.md`:

**Why Fastify was chosen:**
- 2-3x faster than Express in benchmarks
- Native schema validation integrates with Zod
- Built-in logging (Pino) - no morgan needed
- Plugin architecture for clean organization
- TypeScript-first design

### 3.2 API Structure

```
/api/v1/
├── auth/              # Authentication endpoints
│   ├── POST /register
│   ├── POST /login
│   └── GET /me
├── users/             # User management
│   ├── GET /
│   ├── GET /:id
│   ├── POST /
│   ├── PUT /:id
│   └── DELETE /:id
├── teams/             # Team management
│   ├── GET /
│   ├── GET /:id
│   ├── POST /
│   ├── PUT /:id
│   ├── DELETE /:id
│   └── /:id/members   # Nested membership routes
├── projects/          # Project CRUD
├── features/          # Feature CRUD with filtering
│   └── /:id/tasks     # Nested task routes
├── tasks/             # Task CRUD
└── statuses/          # Status management per team
```

### 3.3 Middleware Stack

| Middleware | Purpose |
|------------|---------|
| `@fastify/cors` | Cross-origin request handling |
| `@fastify/helmet` | Security headers |
| `@fastify/compress` | Response compression |
| Custom error handler | Standardized error responses |
| Built-in Pino logger | Request logging |

### 3.4 API Features (from docs)

The API implements powerful filtering capabilities aligned with Linear's patterns:

**Text Search:**
```bash
GET /api/v1/features?query=authentication
```

**Status Filtering:**
```bash
GET /api/v1/features?status=Todo
GET /api/v1/features?statusCategory=started
```

**Assignee Filtering:**
```bash
GET /api/v1/features?assignee=me      # Current user
GET /api/v1/features?assignee=none    # Unassigned
GET /api/v1/features?assignee=user@example.com
```

**Date Range Filtering:**
```bash
GET /api/v1/features?createdAt=-P7D   # Last 7 days
GET /api/v1/features?updatedAt=-P1M   # Last month
```

---

## 4. MCP Server Analysis

### 4.1 Purpose

The MCP (Model Context Protocol) server enables AI assistants (like Claude) to interact with SpecTree programmatically. This is a key differentiator for the product.

### 4.2 Implemented Tools

| Tool | Description |
|------|-------------|
| `spectree__search` | Unified search across features and tasks |
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
| `spectree__reorder_*` | Drag-drop reordering tools |

### 4.3 Architecture

```
┌─────────────────────────────────────────────────────┐
│                   MCP Client (Claude)                │
└─────────────────────┬───────────────────────────────┘
                      │ stdio transport
┌─────────────────────▼───────────────────────────────┐
│               SpecTree MCP Server                    │
│  ┌─────────────────────────────────────────────┐    │
│  │           Tool Registry (index.ts)           │    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐        │    │
│  │  │projects │ │features │ │ tasks   │ ...    │    │
│  │  └────┬────┘ └────┬────┘ └────┬────┘        │    │
│  └───────┼───────────┼───────────┼─────────────┘    │
│          │           │           │                   │
│          ▼           ▼           ▼                   │
│  ┌─────────────────────────────────────────────┐    │
│  │              HTTP Client → API Server        │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

---

## 5. Frontend Analysis

### 5.1 Technology Stack

- **React 19**: Latest version with concurrent features
- **Vite 6**: Fast HMR and optimized builds
- **Tailwind CSS 4**: Utility-first styling
- **Radix UI**: Accessible component primitives
- **React Router**: Client-side routing
- **TanStack Query**: Server state management
- **Zustand**: Client state management (auth store)

### 5.2 Project Structure

```
packages/web/src/
├── App.tsx              # Root component with providers
├── router.tsx           # Route definitions
├── main.tsx             # Entry point
├── index.css            # Tailwind imports
├── components/
│   ├── ui/              # Base UI components (buttons, inputs, etc.)
│   ├── layout/          # Layout components (sidebar, header)
│   ├── common/          # Shared components
│   ├── projects/        # Project-specific components
│   ├── features/        # Feature-specific components
│   ├── tasks/           # Task-specific components
│   └── teams/           # Team-specific components
├── pages/
│   ├── home.tsx
│   ├── login.tsx
│   ├── projects/
│   ├── teams/
│   └── settings.tsx
├── hooks/               # Custom React hooks
├── stores/              # Zustand state stores
└── lib/                 # Utilities and API client
```

### 5.3 State Management

**Server State (TanStack Query):**
- Caching with 1-minute stale time
- Automatic background refetching
- Optimistic updates for mutations

**Client State (Zustand):**
- Authentication state (`auth-store`)
- UI preferences (theme, sidebar state)

### 5.4 Current Implementation Status

| Feature | Status | Notes |
|---------|--------|-------|
| Authentication UI | ✅ Complete | Login/register forms |
| Project List | ⚠️ Scaffolded | Basic structure |
| Feature Board | ⚠️ Scaffolded | Kanban view planned |
| Task Management | ⚠️ Scaffolded | Needs completion |
| Team Settings | ⚠️ Scaffolded | Basic pages exist |
| Dark Mode | ✅ Complete | Theme provider implemented |

---

## 6. Infrastructure Analysis

### 6.1 Azure Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Azure Subscription                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   Resource Group                          │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │                 Virtual Network                      │  │  │
│  │  │   ┌────────────────┐    ┌────────────────────────┐  │  │  │
│  │  │   │ Container Apps │    │  Private Endpoints     │  │  │  │
│  │  │   │    Subnet      │    │       Subnet           │  │  │  │
│  │  │   └────────────────┘    └────────────────────────┘  │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │  │
│  │  │ Container    │  │  SQL Server  │  │  Key Vault   │    │  │
│  │  │    Apps      │  │  (Private)   │  │  (Private)   │    │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘    │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Security Features

| Feature | Implementation |
|---------|----------------|
| **SQL Server Security** | Azure AD auth, TLS 1.2 min, private endpoint only |
| **Key Vault Security** | RBAC authorization, private endpoint, soft delete |
| **Network Security** | VNet isolation, private endpoints, no public access |
| **Audit Logging** | 90-day retention, threat detection enabled |
| **Container Security** | Managed identity, secrets via Key Vault |

### 6.3 Deployment

```bash
# Preview changes
./infra/deploy.sh -e dev --what-if

# Deploy to development
./infra/deploy.sh -e dev

# Deploy to production
./infra/deploy.sh -e prod
```

### 6.4 Local Development

Docker Compose provides local environment with Azure SQL Edge (ARM64 compatible):

```bash
pnpm docker:up      # Start database
pnpm dev            # Start API + Web
```

---

## 7. Documentation Quality Assessment

### 7.1 Existing Documentation

| Document | Quality | Purpose |
|----------|---------|---------|
| `README.md` | ⭐⭐⭐⭐⭐ | Comprehensive setup and usage guide |
| `CONTRIBUTING.md` | ⭐⭐⭐⭐⭐ | Code style, Git workflow, PR process |
| `infra/README.md` | ⭐⭐⭐⭐⭐ | Azure infrastructure documentation |
| `docs/linear-api-patterns.md` | ⭐⭐⭐⭐⭐ | API response shape research |
| `docs/linear-hierarchy-model.md` | ⭐⭐⭐⭐⭐ | Data model research |
| `docs/linear-authorization-model.md` | ⭐⭐⭐⭐ | RBAC patterns |
| `docs/linear-status-workflow.md` | ⭐⭐⭐⭐⭐ | Status category system |
| `docs/linear-ordering-behavior.md` | ⭐⭐⭐⭐⭐ | Fractional indexing research |
| `docs/research-express-vs-fastify.md` | ⭐⭐⭐⭐ | Framework decision record |

### 7.2 Documentation Strengths

1. **Research-driven design**: Extensive Linear API analysis informs architecture
2. **Decision records**: Framework choices are documented with rationale
3. **Operational guides**: Clear setup and deployment instructions
4. **Code style guide**: Comprehensive TypeScript/React conventions

---

## 8. Code Quality Assessment

### 8.1 Strengths

1. **Type Safety**: Strict TypeScript mode with explicit types
2. **Consistent Patterns**: Fastify plugin architecture for routes
3. **Error Handling**: Centralized error handler with custom error classes
4. **Validation**: Zod schemas for request/response validation
5. **Clean Architecture**: Clear separation between routes, services, and data access

### 8.2 Areas for Improvement

| Area | Current State | Recommendation |
|------|---------------|----------------|
| Test Coverage | Basic setup | Add integration tests for API routes |
| API Documentation | In code only | Add OpenAPI/Swagger specification |
| Frontend Tests | None visible | Add component tests with Testing Library |
| E2E Tests | None | Consider Playwright for critical paths |
| Logging | Basic Pino | Add structured logging with correlation IDs |

---

## 9. Linear Compatibility Analysis

### 9.1 Alignment with Linear Patterns

| Pattern | SpecTree Implementation | Compatibility |
|---------|------------------------|---------------|
| Pagination | Cursor-based with `hasNextPage` | ✅ Compatible |
| Response envelope | `{ entities: [], hasNextPage, cursor }` | ✅ Compatible |
| Status categories | 5-category system (backlog → canceled) | ✅ Compatible |
| Hierarchy | Team → Project → Feature → Task | ✅ Compatible |
| Identifiers | `TEAM-NNN` format | ✅ Compatible |
| Denormalized relations | Name + ID for foreign keys | ✅ Compatible |
| Sort order | Float-based fractional indexing | ✅ Compatible |

### 9.2 MCP Server Compatibility

The MCP server is designed to enable seamless switching between Linear and SpecTree:

- Tool naming follows `spectree__<action>` pattern
- Search/filter parameters match Linear's conventions
- Response shapes align with Linear's patterns

---

## 10. Recommendations

### 10.1 High Priority

1. **Complete Frontend Implementation**
   - Finish Kanban board view for features
   - Implement drag-drop reordering
   - Add real-time updates (WebSockets or polling)

2. **Expand Test Coverage**
   - Add API integration tests
   - Add frontend component tests
   - Implement E2E tests for critical flows

3. **Add OpenAPI Specification**
   - Document all API endpoints
   - Enable client code generation
   - Improve API discoverability

### 10.2 Medium Priority

4. **Implement Real-time Features**
   - WebSocket support for live updates
   - Optimistic UI updates
   - Conflict resolution for concurrent edits

5. **Add Audit Logging**
   - Track all entity changes
   - User activity logging
   - Integration with Azure Monitor

6. **Performance Optimization**
   - Database query optimization
   - Response caching strategy
   - Frontend code splitting

### 10.3 Future Considerations

7. **Feature Enhancements**
   - Cycles/Sprints (like Linear)
   - Labels and custom fields
   - Comments and activity feed
   - File attachments
   - Integrations (GitHub, Slack)

8. **Scale Considerations**
   - Read replicas for database
   - Redis caching layer
   - CDN for static assets

---

## 11. Conclusion

SpecTree is a well-architected project management platform with:

- **Strong technical foundation**: Modern TypeScript monorepo with production-ready tooling
- **Clear design philosophy**: Research-driven decisions documented thoroughly
- **Unique value proposition**: MCP server enables AI-assisted project management
- **Production-ready infrastructure**: Azure deployment with security best practices

The project is at an **early production-ready stage** for the backend/API, with the frontend requiring completion to deliver a full user experience. The extensive documentation and clean architecture make it easy for developers to contribute effectively.

### Maturity Assessment

| Component | Maturity Level |
|-----------|----------------|
| API | Beta (feature complete, needs testing) |
| MCP Server | Beta (functional, needs polish) |
| Frontend | Alpha (scaffolded, incomplete) |
| Infrastructure | Production (security hardened) |
| Documentation | Production (comprehensive) |

---

*Analysis conducted by reviewing all source files, documentation, and configuration in the SpecTree repository.*
