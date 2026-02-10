# Contributing to SpecTree

Thank you for your interest in contributing to SpecTree! This guide covers our development workflow, coding standards, and submission process.

## Table of Contents

- [Development Setup](#development-setup)
- [Code Style Guidelines](#code-style-guidelines)
- [Git Workflow](#git-workflow)
- [Pull Request Process](#pull-request-process)
- [Commit Messages](#commit-messages)
- [Code Review](#code-review)
- [Security Best Practices](#security-best-practices)
- [Running Tests](#running-tests)

## Development Setup

Before contributing, ensure your environment is set up correctly:

### 1. Prerequisites

- Node.js 20+
- pnpm 9+

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Start the API Server

```bash
cd packages/api
npm run dev
# API running at http://localhost:3001
```

> **Note**: The database uses SQLite, which is file-based and requires no separate database server.

### 4. Configure MCP for Development

For MCP development, you need an API token:

1. Start the dev server and log in
2. Generate a token via the API:
   ```bash
   # Login to get a JWT
   curl -X POST http://localhost:3001/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@spectree.dev","password":"Password123!"}'
   
   # Create API token (use accessToken from login response)
   curl -X POST http://localhost:3001/api/v1/tokens \
     -H "Authorization: Bearer <jwt>" \
     -H "Content-Type: application/json" \
     -d '{"name":"Dev MCP"}'
   ```

3. Set environment for MCP development:
   ```bash
   export API_TOKEN="st_your_token"
   export API_BASE_URL="http://localhost:3001"
   cd packages/mcp
   pnpm run dev
   ```

### 5. Verify Setup

```bash
pnpm build && pnpm test
```

## Code Style Guidelines

### TypeScript

We use TypeScript in strict mode across all packages. Follow these guidelines:

#### General Principles

- **Explicit types**: Prefer explicit type annotations for function parameters and return types
- **No `any`**: Avoid `any` type; use `unknown` if the type is truly unknown
- **Immutability**: Prefer `const` over `let`; use `readonly` for properties that shouldn't change
- **Null safety**: Handle null/undefined explicitly; avoid non-null assertions (`!`)

#### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Variables, functions | camelCase | `getUserById`, `isValid` |
| Classes, interfaces, types | PascalCase | `UserService`, `ApiResponse` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRIES`, `API_BASE_URL` |
| Files | kebab-case | `user-service.ts`, `api-types.ts` |
| React components | PascalCase files | `UserProfile.tsx` |

#### Import Organization

Organize imports in this order, with blank lines between groups:

```typescript
// 1. Node.js built-in modules
import { readFile } from "node:fs/promises";

// 2. External dependencies
import { z } from "zod";
import type { FastifyInstance } from "fastify";

// 3. Internal packages (@spectree/*)
import { ApiError } from "@spectree/shared";

// 4. Relative imports
import { validateUser } from "./validators";
import type { UserInput } from "./types";
```

#### Type Imports

Use type-only imports when importing only types:

```typescript
// Correct
import type { User } from "./types";
import { validateUser, type ValidationResult } from "./validators";

// Incorrect
import { User } from "./types"; // if User is only a type
```

### React (Frontend)

#### Component Structure

```typescript
// 1. Imports
import { useState, useEffect } from "react";
import type { FC } from "react";

// 2. Types
interface UserCardProps {
  user: User;
  onSelect?: (id: string) => void;
}

// 3. Component
export const UserCard: FC<UserCardProps> = ({ user, onSelect }) => {
  // Hooks first
  const [isExpanded, setIsExpanded] = useState(false);

  // Event handlers
  const handleClick = () => {
    onSelect?.(user.id);
  };

  // Render
  return (
    <div onClick={handleClick}>
      {user.name}
    </div>
  );
};
```

#### Component Guidelines

- Use functional components with hooks
- Prefer named exports over default exports
- Keep components focused and single-purpose
- Extract reusable logic into custom hooks

### Styling (Tailwind CSS)

- Use Tailwind utility classes directly in components
- Extract repeated patterns into components, not CSS classes
- Use the `cn()` utility for conditional classes:

```typescript
import { cn } from "@/lib/utils";

<button className={cn(
  "px-4 py-2 rounded",
  isActive && "bg-blue-500",
  disabled && "opacity-50 cursor-not-allowed"
)}>
```

### API Routes (Fastify)

```typescript
// Define schema with Zod
const createUserSchema = {
  body: z.object({
    email: z.string().email(),
    name: z.string().min(1),
  }),
  response: {
    201: z.object({
      id: z.string(),
      email: z.string(),
      name: z.string(),
    }),
  },
};

// Register route
app.post("/users", {
  schema: createUserSchema,
  handler: async (request, reply) => {
    const user = await userService.create(request.body);
    return reply.status(201).send(user);
  },
});
```

### Linting and Formatting

We use ESLint and Prettier. Run these before committing:

```bash
# Check for lint errors
pnpm lint

# Fix lint errors automatically
pnpm lint:fix

# Format code
pnpm format

# Check formatting without changes
pnpm format:check
```

**ESLint Configuration**: We use ESLint 9 with flat config. See `eslint.config.js` for rules.

**Prettier Configuration**: See `.prettierrc` for formatting options.

## Git Workflow

We use a **trunk-based development** workflow with continuous deployment from the `main` branch.

### Current Workflow

- **`main` branch**: The single integration branch - always deployable, deploys automatically to Azure
- **Feature branches**: Short-lived branches created from `main` for new functionality
- **Pull Requests**: All changes must go through PR review before merging to `main`
- **Continuous Deployment**: Every merge to `main` triggers automated deployment to Azure

> **🚀 Future Workflow**: As SpecTree matures into production with customer deployments, we will adopt a release train workflow with dedicated release branches for QA stabilization. See [`docs/git/git-release-flow-strategy-final-with-definitions.md`](./docs/git/git-release-flow-strategy-final-with-definitions.md) for the planned future workflow.

### Branch Naming

Use this format: `<type>/<ticket>-<short-description>`

| Type | Use Case | Example |
|------|----------|---------|
| `feature/` | New features | `feature/ENG-123-user-auth` |
| `fix/` | Bug fixes | `fix/ENG-456-login-error` |
| `refactor/` | Code refactoring | `refactor/ENG-789-api-cleanup` |
| `docs/` | Documentation | `docs/ENG-012-api-docs` |
| `chore/` | Maintenance tasks | `chore/update-dependencies` |

> **Note**: Use your team's issue tracking prefix (e.g., `ENG-` for Engineering team issues).

### Workflow Steps

1. **Create a branch** from `main`:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/ENG-123-new-feature
   ```

2. **Make changes** with atomic commits (see [Commit Messages](#commit-messages))

3. **Keep branch updated** with main:
   ```bash
   git fetch origin
   git rebase origin/main
   ```

4. **Push and create PR**:
   ```bash
   git push -u origin feature/ENG-123-new-feature
   ```

5. **After PR approval**, the PR will be **squash merged** into `main`

6. **Automatic deployment**: Changes merged to `main` automatically deploy to Azure

### Branch Rules

- **Never commit directly to `main`** - all changes must go through PR review
- Keep branches short-lived (< 1 week ideally)
- Delete branches after merging
- Rebase onto `main` before creating PR to keep history clean
- PRs are squash merged to maintain clean commit history on `main`

## Pull Request Process

### Before Creating a PR

1. **Run all checks locally**:
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm build
   ```

2. **Update documentation** if you changed public APIs or configuration

3. **Add tests** for new functionality

### PR Template

When creating a PR, include:

```markdown
## Summary
Brief description of what this PR does.

## Changes
- List of specific changes made
- Another change

## Testing
- How you tested these changes
- Any manual testing steps

## Screenshots (if UI changes)
Before/after screenshots if applicable

## Checklist
- [ ] Tests pass locally
- [ ] Code follows style guidelines
- [ ] Documentation updated (if needed)
- [ ] Linked to Linear issue
```

### PR Guidelines

- **Keep PRs focused**: One feature or fix per PR
- **Size matters**: Aim for < 400 lines changed; split larger changes
- **Self-review first**: Review your own diff before requesting reviews
- **Respond promptly**: Address review comments within 24 hours
- **Link issues**: Reference the Linear issue (e.g., "Implements COM-123")

## Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no code change |
| `refactor` | Code change without feature/fix |
| `test` | Adding or updating tests |
| `chore` | Maintenance, dependencies, config |

### Scopes

Use package names or areas: `api`, `web`, `mcp`, `shared`, `infra`, `deps`

### Examples

```bash
# Feature
feat(api): add user authentication endpoint

# Bug fix
fix(web): resolve login form validation error

# Documentation
docs: update README with MCP setup instructions

# Refactoring
refactor(api): extract validation logic to shared module

# With body and footer
feat(api): implement rate limiting

Add rate limiting middleware to protect API endpoints.
Default limit is 100 requests per minute per IP.

Closes COM-456
```

### Commit Guidelines

- Use imperative mood: "add feature" not "added feature"
- Keep subject line under 72 characters
- Capitalize the subject line
- Don't end subject with a period
- Separate subject from body with blank line
- Explain *what* and *why*, not *how*

## Code Review

### For Authors

- **Be receptive**: Treat feedback as a learning opportunity
- **Explain context**: If a reviewer misunderstands, provide more context
- **Don't take it personally**: Reviews are about code, not you
- **Resolve conversations**: Mark comments as resolved when addressed

### For Reviewers

- **Be respectful**: Critique code, not the person
- **Be specific**: "Consider using X because Y" is better than "This is wrong"
- **Ask questions**: "What's the reason for X?" opens dialogue
- **Praise good work**: Positive feedback is valuable too
- **Focus on**:
  - Correctness and logic errors
  - Security vulnerabilities
  - Performance implications
  - Test coverage
  - Code clarity and maintainability

### Review Checklist

- [ ] Code accomplishes the stated goal
- [ ] Logic is correct and handles edge cases
- [ ] No security vulnerabilities introduced
- [ ] Tests cover new/changed functionality
- [ ] Code follows project style guidelines
- [ ] No unnecessary complexity added
- [ ] Error handling is appropriate
- [ ] Documentation is updated if needed

## Security Best Practices

When contributing to SpecTree, follow these security guidelines:

### Secrets Management

- **Never** commit API tokens, passwords, or secrets
- Use environment variables for all sensitive values
- In production, use Azure Key Vault (see [Azure deployment guide](./docs/azure-deployment-guide.md))

### API Authentication

- All MCP requests must go through the API (not direct DB)
- Use API tokens for programmatic access
- JWTs are for web UI sessions only

### Database Access

- MCP package should NEVER import Prisma directly
- All database operations go through the API
- Tests may use direct Prisma in test setup only

### Security Code Review Checklist

- [ ] No hardcoded secrets
- [ ] No direct database imports in MCP
- [ ] API tokens validated in all protected routes
- [ ] Sensitive data not logged

For more details, see the [Security Architecture](./docs/mcp/security-architecture.md) documentation.

## Running Tests

### API Tests

```bash
cd packages/api
pnpm test
```

### MCP Integration Tests

MCP tests use mocked API responses and don't require a running API server:

```bash
cd packages/mcp
pnpm test
```

### Full Test Suite

```bash
pnpm test
```

## Questions?

If you have questions about contributing:

1. Check existing documentation in this repo
2. Look for similar past PRs for examples
3. Ask in the team chat or open a discussion

Thank you for contributing to SpecTree!
