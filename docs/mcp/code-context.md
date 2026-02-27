# Code Context (Codebase Integration)

> **⚠️ DEPRECATION NOTICE:**  
> The individual code context tools (`dispatcher__get_code_context`, `dispatcher__link_code_file`, `dispatcher__unlink_code_file`, `dispatcher__link_function`, `dispatcher__link_branch`, `dispatcher__link_commit`, `dispatcher__link_pr`) are **DEPRECATED**.  
>  
> **Use instead:** `dispatcher__manage_code_context` with action-based routing:
> - `action='get_context'` - Get all code artifacts
> - `action='link_file'` - Link a file  
> - `action='unlink_file'` - Remove a file link
> - `action='link_function'` - Link a function
> - `action='link_branch'` - Link git branch
> - `action='link_commit'` - Link git commit
> - `action='link_pr'` - Link pull request
>
> See [Tools Reference](./tools-reference.md#dispatcher__manage_code_context) for complete documentation.

Code Context provides a way to link features and tasks directly to code artifacts, enabling AI agents to instantly understand the code context for any work item without needing to search or explore.

## Overview

Unlike structured descriptions which store high-level planning info (`filesInvolved`, `functionsToModify`), Code Context tracks **actual implementations**:

- **Files** - Source files that implement or are modified by this work
- **Functions** - Specific functions/methods touched by this work  
- **Git branch** - The active development branch
- **Git commits** - All commits related to this work
- **Pull Request** - The PR that merges this work

This creates a bidirectional link between project management and code, making it easy for AI agents to:
- Find the exact code relevant to a task
- Understand what was changed and where
- Resume work on a feature with full context

## Data Model

Both Feature and Task models include these fields:

| Field | Type | Description |
|-------|------|-------------|
| `relatedFiles` | `string[]` | Array of file paths |
| `relatedFunctions` | `string[]` | Array in format `"filePath:functionName"` |
| `gitBranch` | `string` | Current working branch |
| `gitCommits` | `string[]` | Array of commit SHAs |
| `gitPrNumber` | `number` | PR number |
| `gitPrUrl` | `string` | PR URL |

## MCP Tools

### dispatcher__link_code_file

Add a file to a feature or task's related files list.

```typescript
dispatcher__link_code_file({
  id: "COM-123",           // Feature or task identifier
  type: "feature",         // "feature" or "task"
  filePath: "src/services/userService.ts"
})
```

Duplicates are silently ignored.

### dispatcher__unlink_code_file

Remove a file from the related files list.

```typescript
dispatcher__unlink_code_file({
  id: "COM-123",
  type: "feature",
  filePath: "src/services/userService.ts"
})
```

### dispatcher__link_function

Add a function reference. Functions are stored as `"filePath:functionName"`.

```typescript
dispatcher__link_function({
  id: "COM-123",
  type: "feature",
  filePath: "src/services/userService.ts",
  functionName: "createUser"
})
```

### dispatcher__link_branch

Set or update the git branch. Only one branch per item.

```typescript
dispatcher__link_branch({
  id: "COM-123",
  type: "feature",
  branch: "feature/COM-123-user-auth"
})
```

### dispatcher__link_commit

Add a commit SHA to the commits list. Duplicates ignored, commits accumulate.

```typescript
dispatcher__link_commit({
  id: "COM-123",
  type: "feature",
  commitSha: "abc123def456"
})
```

### dispatcher__link_pr

Link a pull request. Only one PR per item (replaces previous).

```typescript
dispatcher__link_pr({
  id: "COM-123",
  type: "feature",
  prNumber: 42,
  prUrl: "https://github.com/org/repo/pull/42"  // optional
})
```

### dispatcher__get_code_context

Retrieve all code context for a feature or task.

```typescript
const context = dispatcher__get_code_context({
  id: "COM-123",
  type: "feature"
})

// Returns:
{
  relatedFiles: ["src/services/userService.ts"],
  relatedFunctions: ["src/services/userService.ts:createUser"],
  gitBranch: "feature/COM-123-user-auth",
  gitCommits: ["abc123def456"],
  gitPrNumber: 42,
  gitPrUrl: "https://github.com/org/repo/pull/42"
}
```

## Recommended Workflow

### Starting Work on a Feature

1. **Get existing context** to see what was previously tracked:
   ```typescript
   const context = dispatcher__get_code_context({ id: "COM-123", type: "feature" })
   ```

2. **Link your branch** when you create it:
   ```typescript
   dispatcher__link_branch({ 
     id: "COM-123", 
     type: "feature",
     branch: "feature/COM-123-description" 
   })
   ```

### During Development

3. **Link files as you modify them**:
   ```typescript
   dispatcher__link_code_file({
     id: "COM-123",
     type: "feature",
     filePath: "src/routes/users.ts"
   })
   ```

4. **Link functions for significant changes**:
   ```typescript
   dispatcher__link_function({
     id: "COM-123",
     type: "feature",
     filePath: "src/routes/users.ts",
     functionName: "handleUserCreate"
   })
   ```

5. **Record commits** after committing:
   ```typescript
   dispatcher__link_commit({
     id: "COM-123",
     type: "feature",
     commitSha: "abc123"
   })
   ```

### Completing Work

6. **Link the PR** when opened:
   ```typescript
   dispatcher__link_pr({
     id: "COM-123",
     type: "feature",
     prNumber: 42,
     prUrl: "https://github.com/org/repo/pull/42"
   })
   ```

## Difference from Structured Descriptions

| Structured Descriptions | Code Context |
|------------------------|--------------|
| `filesInvolved` - Files that *might* be modified | `relatedFiles` - Files actually modified |
| `functionsToModify` - Functions to *plan* to change | `relatedFunctions` - Functions actually changed |
| Planning/specification focused | Implementation/tracking focused |
| Set before work begins | Updated during/after work |

Both can be used together - structured descriptions for planning, code context for tracking actual changes.

## API Endpoints

All endpoints require authentication and team access.

### Features

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/features/:id/code-context/file` | Link a file |
| DELETE | `/features/:id/code-context/file` | Unlink a file |
| POST | `/features/:id/code-context/function` | Link a function |
| POST | `/features/:id/code-context/branch` | Set branch |
| POST | `/features/:id/code-context/commit` | Add commit |
| POST | `/features/:id/code-context/pr` | Set PR |
| GET | `/features/:id/code-context` | Get all context |

### Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/tasks/:id/code-context/file` | Link a file |
| DELETE | `/tasks/:id/code-context/file` | Unlink a file |
| POST | `/tasks/:id/code-context/function` | Link a function |
| POST | `/tasks/:id/code-context/branch` | Set branch |
| POST | `/tasks/:id/code-context/commit` | Add commit |
| POST | `/tasks/:id/code-context/pr` | Set PR |
| GET | `/tasks/:id/code-context` | Get all context |
