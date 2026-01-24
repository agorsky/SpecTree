# Contributing to SpecTree

Thank you for your interest in contributing to SpecTree! This guide covers our development workflow, coding standards, and submission process.

## Table of Contents

- [Development Setup](#development-setup)
- [Code Style Guidelines](#code-style-guidelines)
- [Git Workflow](#git-workflow)
- [Pull Request Process](#pull-request-process)
- [Commit Messages](#commit-messages)
- [Code Review](#code-review)

## Development Setup

Before contributing, ensure your environment is set up correctly:

1. **Prerequisites**: Node.js 20+, pnpm 9+, Docker
2. **Clone and install**: See [README.md Quick Start](./README.md#quick-start)
3. **Verify setup**: Run `pnpm build && pnpm test` to ensure everything works

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

We use a trunk-based development workflow with short-lived feature branches.

### Branch Naming

Use this format: `<type>/<ticket>-<short-description>`

| Type | Use Case | Example |
|------|----------|---------|
| `feature/` | New features | `feature/COM-123-user-auth` |
| `fix/` | Bug fixes | `fix/COM-456-login-error` |
| `refactor/` | Code refactoring | `refactor/COM-789-api-cleanup` |
| `docs/` | Documentation | `docs/COM-012-api-docs` |
| `chore/` | Maintenance tasks | `chore/update-dependencies` |

### Workflow Steps

1. **Create a branch** from `main`:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/COM-123-new-feature
   ```

2. **Make changes** with atomic commits (see [Commit Messages](#commit-messages))

3. **Keep branch updated** with main:
   ```bash
   git fetch origin
   git rebase origin/main
   ```

4. **Push and create PR**:
   ```bash
   git push -u origin feature/COM-123-new-feature
   ```

5. **After PR approval**, squash and merge into main

### Branch Rules

- Never commit directly to `main`
- Keep branches short-lived (< 1 week ideally)
- Delete branches after merging
- Rebase onto main before merging to keep history clean

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

## Questions?

If you have questions about contributing:

1. Check existing documentation in this repo
2. Look for similar past PRs for examples
3. Ask in the team chat or open a discussion

Thank you for contributing to SpecTree!
