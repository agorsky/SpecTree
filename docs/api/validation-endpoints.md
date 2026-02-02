# Validation Checklist Endpoints

Task validation endpoints allow you to define and run executable acceptance criteria that verify work is truly "done".

## Base URL

All endpoints are prefixed with `/api/v1/tasks/:taskId/validations`

## Authentication

All endpoints require a valid API token in the `Authorization` header:

```
Authorization: Bearer <your-api-token>
```

## Endpoints

### List Validations

**GET** `/api/v1/tasks/:taskId/validations`

Returns all validation checks for a task with their current status.

**Response:**
```json
{
  "data": {
    "taskId": "550e8400-e29b-41d4-a716-446655440000",
    "identifier": "COM-123-1",
    "checks": [
      {
        "id": "abc12345-...",
        "type": "command",
        "description": "Tests pass",
        "command": "pnpm test",
        "expectedExitCode": 0,
        "timeoutMs": 30000,
        "status": "passed",
        "lastCheckedAt": "2024-01-15T10:30:00Z",
        "lastOutput": "All 42 tests passed"
      },
      {
        "id": "def67890-...",
        "type": "manual",
        "description": "Code review completed",
        "status": "pending"
      }
    ],
    "summary": {
      "total": 2,
      "passed": 1,
      "failed": 0,
      "pending": 1
    }
  }
}
```

---

### Add Validation

**POST** `/api/v1/tasks/:taskId/validations`

Adds a new validation check to the task.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | One of: `command`, `file_exists`, `file_contains`, `test_passes`, `manual` |
| `description` | string | Yes | Human-readable description (max 500 chars) |
| `command` | string | For `command` | Shell command to execute |
| `expectedExitCode` | number | No | Expected exit code (default: 0) |
| `timeoutMs` | number | No | Timeout in ms (default: 30000, max: 300000) |
| `filePath` | string | For `file_exists`, `file_contains` | File path to check |
| `searchPattern` | string | For `file_contains` | Regex pattern to search |
| `testCommand` | string | For `test_passes` | Test command to run |

**Example - Command Check:**
```json
{
  "type": "command",
  "description": "Linting passes",
  "command": "pnpm lint",
  "expectedExitCode": 0
}
```

**Example - File Exists Check:**
```json
{
  "type": "file_exists",
  "description": "Config file exists",
  "filePath": "src/config/settings.ts"
}
```

**Example - File Contains Check:**
```json
{
  "type": "file_contains",
  "description": "Export statement exists",
  "filePath": "src/index.ts",
  "searchPattern": "export.*validateUser"
}
```

**Example - Test Passes Check:**
```json
{
  "type": "test_passes",
  "description": "Unit tests pass",
  "testCommand": "pnpm test --filter userService"
}
```

**Example - Manual Check:**
```json
{
  "type": "manual",
  "description": "UI reviewed on mobile devices"
}
```

**Response:**
```json
{
  "data": {
    "id": "abc12345-...",
    "type": "command",
    "description": "Linting passes",
    "command": "pnpm lint",
    "expectedExitCode": 0,
    "timeoutMs": 30000,
    "status": "pending"
  }
}
```

---

### Remove Validation

**DELETE** `/api/v1/tasks/:taskId/validations/:checkId`

Removes a validation check from the task.

**Response:** `204 No Content`

---

### Run Single Validation

**POST** `/api/v1/tasks/:taskId/validations/:checkId/run`

Runs a single validation check and returns the result.

**Request Body (optional):**
```json
{
  "workingDirectory": "/path/to/project"
}
```

**Response:**
```json
{
  "data": {
    "id": "abc12345-...",
    "description": "Tests pass",
    "type": "command",
    "status": "passed",
    "passed": true,
    "output": "All 42 tests passed\nDuration: 5.2s",
    "durationMs": 5234
  }
}
```

**Failure Response:**
```json
{
  "data": {
    "id": "abc12345-...",
    "description": "Tests pass",
    "type": "command",
    "status": "failed",
    "passed": false,
    "error": "Exit code 1 (expected 0)",
    "output": "1 test failed...",
    "durationMs": 3100
  }
}
```

---

### Run All Validations

**POST** `/api/v1/tasks/:taskId/validations/run-all`

Runs all automated validation checks. Manual checks are included in results but not executed.

**Request Body (optional):**
```json
{
  "stopOnFailure": false,
  "workingDirectory": "/path/to/project"
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `stopOnFailure` | boolean | false | Stop executing after first failure |
| `workingDirectory` | string | cwd | Base directory for file paths and commands |

**Response:**
```json
{
  "data": {
    "taskId": "550e8400-...",
    "identifier": "COM-123-1",
    "totalChecks": 4,
    "passed": 2,
    "failed": 1,
    "pending": 1,
    "allPassed": false,
    "results": [
      {
        "id": "...",
        "description": "Tests pass",
        "type": "test_passes",
        "status": "passed",
        "passed": true,
        "durationMs": 12500
      },
      {
        "id": "...",
        "description": "Lint passes",
        "type": "command",
        "status": "failed",
        "passed": false,
        "error": "Exit code 1",
        "durationMs": 3200
      },
      {
        "id": "...",
        "description": "Manual review",
        "type": "manual",
        "status": "pending",
        "passed": false,
        "error": "Manual verification required"
      }
    ]
  }
}
```

---

### Mark Manual Validated

**POST** `/api/v1/tasks/:taskId/validations/:checkId/manual-validate`

Marks a manual validation check as passed. Only works for checks with `type: "manual"`.

**Request Body (optional):**
```json
{
  "notes": "Verified by John on staging environment"
}
```

**Response:**
```json
{
  "data": {
    "id": "abc12345-...",
    "type": "manual",
    "description": "UI reviewed on mobile devices",
    "status": "passed",
    "lastCheckedAt": "2024-01-15T10:30:00Z",
    "lastOutput": "Verified by John on staging environment"
  }
}
```

**Error (not a manual check):**
```json
{
  "error": "Validation Error",
  "message": "Only manual validation checks can be marked as validated manually"
}
```

---

### Reset Validations

**POST** `/api/v1/tasks/:taskId/validations/reset`

Resets all validation checks to `pending` status. Clears any previous results, errors, and outputs.

**Response:**
```json
{
  "data": {
    "taskId": "550e8400-...",
    "identifier": "COM-123-1",
    "checks": [...],
    "summary": {
      "total": 4,
      "passed": 0,
      "failed": 0,
      "pending": 4
    }
  }
}
```

---

## Security

### Blocked Command Patterns

The following patterns are blocked for security:

- `rm -rf /` or `rm -rf ~` — Destructive deletions
- `mkfs` — Filesystem formatting
- `dd if=` — Raw disk access
- `chmod 777` — Overly permissive permissions
- `curl|sh` or `wget|sh` — Remote code execution
- `eval` — Arbitrary code execution
- Fork bombs

Blocked commands return:
```json
{
  "data": {
    "passed": false,
    "error": "Command rejected: potentially dangerous operation detected"
  }
}
```

### Timeouts

| Check Type | Default Timeout | Maximum Timeout |
|------------|-----------------|-----------------|
| `command` | 30 seconds | 5 minutes |
| `test_passes` | 2 minutes | 5 minutes |
| `file_exists` | N/A | N/A |
| `file_contains` | N/A | N/A |
| `manual` | N/A | N/A |

---

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Invalid request body or validation type |
| 401 | Missing or invalid authentication |
| 403 | User does not have access to this task's team |
| 404 | Task or validation check not found |
