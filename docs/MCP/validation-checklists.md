# Validation Checklists

Validation Checklists define executable acceptance criteria for tasks. They allow AI agents and developers to verify that work is truly "done" by running automated checks.

## Overview

Validation checks are stored on tasks and can be:

- **Automated**: Commands, file checks, and tests that run automatically
- **Manual**: Require human verification

Each check tracks its status (`pending`, `passed`, `failed`) and can be re-run as needed.

## Validation Check Types

### `command`

Runs a shell command and checks the exit code.

```json
{
  "type": "command",
  "description": "Linting passes",
  "command": "pnpm lint",
  "expectedExitCode": 0,
  "timeoutMs": 30000
}
```

### `file_exists`

Verifies a file exists at the specified path.

```json
{
  "type": "file_exists",
  "description": "Config file exists",
  "filePath": "src/config/settings.ts"
}
```

### `file_contains`

Searches file content using a regex pattern.

```json
{
  "type": "file_contains",
  "description": "Export statement exists",
  "filePath": "src/index.ts",
  "searchPattern": "export\\s+\\{.*validateUser.*\\}"
}
```

### `test_passes`

Runs a test command (defaults to 2 minute timeout).

```json
{
  "type": "test_passes",
  "description": "Unit tests pass",
  "testCommand": "pnpm test --filter userService"
}
```

### `manual`

Requires human verification - cannot be auto-run.

```json
{
  "type": "manual",
  "description": "UI looks correct on mobile"
}
```

## MCP Tools

### Adding Validations

**`spectree__add_validation`** - Add a validation check to a task.

```typescript
// Add a command check
await spectree__add_validation({
  taskId: "COM-123-1",
  type: "command",
  description: "Build succeeds",
  command: "pnpm build"
});

// Add a file exists check
await spectree__add_validation({
  taskId: "COM-123-1",
  type: "file_exists",
  description: "New service file created",
  filePath: "src/services/newService.ts"
});

// Add a manual check
await spectree__add_validation({
  taskId: "COM-123-1",
  type: "manual",
  description: "Reviewed by team lead"
});
```

### Listing Validations

**`spectree__list_validations`** - List all checks for a task with status summary.

```typescript
const result = await spectree__list_validations({
  taskId: "COM-123-1"
});

// Returns:
{
  "taskId": "...",
  "identifier": "COM-123-1",
  "checks": [...],
  "summary": {
    "total": 3,
    "passed": 1,
    "failed": 0,
    "pending": 2
  }
}
```

### Running Validations

**`spectree__run_validation`** - Run a single validation check.

```typescript
const result = await spectree__run_validation({
  taskId: "COM-123-1",
  checkId: "550e8400-e29b-41d4-a716-446655440000",
  workingDirectory: "/path/to/project"
});
```

**`spectree__run_all_validations`** - Run all automated checks.

```typescript
const result = await spectree__run_all_validations({
  taskId: "COM-123-1",
  stopOnFailure: true,  // Stop after first failure
  workingDirectory: "/path/to/project"
});

// Returns:
{
  "taskId": "...",
  "totalChecks": 3,
  "passed": 2,
  "failed": 0,
  "pending": 1,  // Manual checks stay pending
  "allPassed": false,
  "results": [...]
}
```

### Manual Verification

**`spectree__mark_manual_validated`** - Mark a manual check as passed.

```typescript
await spectree__mark_manual_validated({
  taskId: "COM-123-1",
  checkId: "550e8400-e29b-41d4-a716-446655440000",
  notes: "Verified mobile layout looks correct"
});
```

### Managing Validations

**`spectree__remove_validation`** - Remove a validation check.

```typescript
await spectree__remove_validation({
  taskId: "COM-123-1",
  checkId: "550e8400-e29b-41d4-a716-446655440000"
});
```

**`spectree__reset_validations`** - Reset all checks to pending.

```typescript
await spectree__reset_validations({
  taskId: "COM-123-1"
});
```

## Workflow Integration

### Defining Acceptance Criteria

When starting a task, define validation checks as executable acceptance criteria:

```typescript
// Start work on task
await spectree__start_work({ id: "COM-123-1", type: "task" });

// Define what "done" looks like
await spectree__add_validation({
  taskId: "COM-123-1",
  type: "test_passes",
  description: "New feature has tests",
  testCommand: "pnpm test --filter newFeature"
});

await spectree__add_validation({
  taskId: "COM-123-1",
  type: "command",
  description: "No type errors",
  command: "pnpm typecheck"
});
```

### Verifying Work

Before marking work complete, run all validations:

```typescript
// Check if work is done
const result = await spectree__run_all_validations({
  taskId: "COM-123-1",
  workingDirectory: process.cwd()
});

if (result.allPassed) {
  await spectree__complete_work({
    id: "COM-123-1",
    type: "task",
    summary: "All validations passed"
  });
}
```

## Security

Command execution includes safety measures:

### Blocked Patterns

The following patterns are rejected:

- `rm -rf /` or `rm -rf ~` - Destructive deletions
- `mkfs` - Format commands
- `dd if=` - Raw disk access
- `chmod 777` - Overly permissive permissions
- `curl|sh` or `wget|sh` - Remote code execution
- `eval` - Arbitrary code execution
- Fork bombs

### Timeout Limits

- Default timeout: 30 seconds
- Maximum timeout: 5 minutes
- Test commands default to 2 minutes

### Working Directory

All file paths are resolved relative to the optional `workingDirectory` parameter. If not provided, defaults to current working directory.

## API Endpoints

The REST API provides these endpoints:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/tasks/:id/validations` | List validation checks |
| POST | `/api/v1/tasks/:id/validations` | Add a validation check |
| DELETE | `/api/v1/tasks/:id/validations/:checkId` | Remove a check |
| POST | `/api/v1/tasks/:id/validations/:checkId/run` | Run a single check |
| POST | `/api/v1/tasks/:id/validations/run-all` | Run all checks |
| POST | `/api/v1/tasks/:id/validations/:checkId/manual-validate` | Mark manual as passed |
| POST | `/api/v1/tasks/:id/validations/reset` | Reset all to pending |

## Best Practices

1. **Start with tests**: If the work involves code, add a `test_passes` check
2. **Include build verification**: Add a `command` check for build/typecheck
3. **Use file checks for new files**: Verify expected files are created
4. **Add manual checks sparingly**: Reserve for things that can't be automated
5. **Reset before re-verifying**: Use `reset_validations` after making changes
6. **Run all before completing**: Always run `run_all_validations` before `complete_work`
