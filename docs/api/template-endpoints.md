# Template API Endpoints

This document describes the API endpoints for the Implementation Plan Template System.

## Overview

Template endpoints enable creating, managing, and using reusable implementation plan templates. Templates define standardized structures for epics with features and tasks, using variable placeholders for customization.

## Authentication

All endpoints except `GET /api/v1/templates` require:
- Valid JWT access token or API token in the `Authorization` header

---

## Template Endpoints

### GET /api/v1/templates

List all available templates.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `builtInOnly` | boolean | Filter to built-in templates only |

**Success Response (200 OK):**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Code Feature",
      "description": "Standard feature implementation workflow",
      "isBuiltIn": true,
      "variables": ["featureName"],
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:00:00.000Z"
    }
  ],
  "meta": {
    "total": 4
  }
}
```

---

### GET /api/v1/templates/:id

Get detailed information about a specific template.

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Template ID (UUID) or name |

**Success Response (200 OK):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Code Feature",
    "description": "Standard feature implementation workflow",
    "isBuiltIn": true,
    "structure": {
      "epicDefaults": { "icon": "⚡", "color": "#3B82F6" },
      "features": [
        {
          "titleTemplate": "{{featureName}} - Design",
          "executionOrder": 1,
          "canParallelize": false,
          "tasks": [
            {
              "titleTemplate": "Create design document",
              "executionOrder": 1
            }
          ]
        }
      ]
    },
    "variables": ["featureName"],
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  }
}
```

**Error Response (404 Not Found):**
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Template with name 'Unknown' not found"
  }
}
```

---

### POST /api/v1/templates

Create a new custom template.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "My Custom Template",
  "description": "Description of the template",
  "structure": {
    "epicDefaults": {
      "icon": "🚀",
      "color": "#FF5733"
    },
    "features": [
      {
        "titleTemplate": "{{taskName}} - Implementation",
        "executionOrder": 1,
        "tasks": [
          {
            "titleTemplate": "Write code for {{taskName}}",
            "executionOrder": 1
          }
        ]
      }
    ]
  }
}
```

**Success Response (201 Created):**
```json
{
  "data": {
    "id": "new-template-uuid",
    "name": "My Custom Template",
    "description": "Description of the template",
    "isBuiltIn": false,
    "variables": ["taskName"],
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  }
}
```

**Error Response (409 Conflict):**
```json
{
  "error": {
    "code": "CONFLICT",
    "message": "Template with name 'My Custom Template' already exists"
  }
}
```

---

### PATCH /api/v1/templates/:id

Update an existing template. Cannot update built-in templates.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Template ID (UUID) |

**Request Body (all fields optional):**
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "structure": { /* updated structure */ }
}
```

**Success Response (200 OK):**
```json
{
  "data": {
    "id": "template-uuid",
    "name": "Updated Name",
    "description": "Updated description",
    "isBuiltIn": false,
    "variables": ["taskName"],
    "updatedAt": "2024-01-15T11:00:00.000Z"
  }
}
```

**Error Response (400 Bad Request - Built-in):**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Built-in templates cannot be modified"
  }
}
```

---

### DELETE /api/v1/templates/:id

Delete a template. Cannot delete built-in templates.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Template ID (UUID) |

**Success Response (204 No Content)**

**Error Response (400 Bad Request - Built-in):**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Built-in templates cannot be deleted"
  }
}
```

---

### POST /api/v1/templates/:id/preview

Preview what would be created from a template without actually creating anything.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Template ID (UUID) or name |

**Request Body:**
```json
{
  "epicName": "User Authentication System",
  "variables": {
    "featureName": "OAuth Login"
  }
}
```

**Success Response (200 OK):**
```json
{
  "data": {
    "epicName": "User Authentication System",
    "epicDescription": null,
    "epicIcon": "⚡",
    "epicColor": "#3B82F6",
    "features": [
      {
        "title": "OAuth Login - Design",
        "description": null,
        "executionOrder": 1,
        "canParallelize": false,
        "tasks": [
          {
            "title": "Create design document",
            "description": null,
            "executionOrder": 1
          }
        ]
      }
    ]
  }
}
```

---

### POST /api/v1/templates/:id/create

Create a full epic/feature/task structure from a template.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Template ID (UUID) or name |

**Request Body:**
```json
{
  "epicName": "User Authentication System",
  "teamId": "team-uuid",
  "variables": {
    "featureName": "OAuth Login"
  }
}
```

**Success Response (201 Created):**
```json
{
  "data": {
    "epic": {
      "id": "epic-uuid",
      "name": "User Authentication System",
      "description": null,
      "icon": "⚡",
      "color": "#3B82F6"
    },
    "features": [
      {
        "id": "feature-uuid",
        "identifier": "ENG-123",
        "title": "OAuth Login - Design",
        "description": null,
        "executionOrder": 1,
        "canParallelize": false,
        "tasks": [
          {
            "id": "task-uuid",
            "identifier": "ENG-123-1",
            "title": "Create design document",
            "description": null,
            "executionOrder": 1
          }
        ]
      }
    ]
  }
}
```

**Error Response (404 Not Found):**
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Team with id 'invalid-uuid' not found"
  }
}
```

---

### POST /api/v1/templates/save-from-epic

Save an existing epic's structure as a new template.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "epicId": "epic-uuid",
  "templateName": "My Project Workflow",
  "description": "Workflow extracted from successful project"
}
```

**Success Response (201 Created):**
```json
{
  "data": {
    "id": "new-template-uuid",
    "name": "My Project Workflow",
    "description": "Workflow extracted from successful project",
    "isBuiltIn": false,
    "variables": [],
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  }
}
```

**Error Response (404 Not Found):**
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Epic with id 'invalid-uuid' not found"
  }
}
```

---

## Template Structure Schema

### TemplateStructure

```typescript
interface TemplateStructure {
  epicDefaults?: {
    icon?: string;
    color?: string;
    descriptionPrompt?: string;
  };
  features: TemplateFeature[];
}
```

### TemplateFeature

```typescript
interface TemplateFeature {
  titleTemplate: string;          // Title with {{variable}} placeholders
  descriptionPrompt?: string;     // Hint for description content
  executionOrder: number;         // Order within epic (1-based)
  canParallelize?: boolean;       // Can run alongside other features
  tasks?: TemplateTask[];         // Nested tasks
}
```

### TemplateTask

```typescript
interface TemplateTask {
  titleTemplate: string;          // Title with {{variable}} placeholders
  descriptionPrompt?: string;     // Hint for description content
  executionOrder: number;         // Order within feature (1-based)
}
```

---

## Variable Substitution

Variables use `{{variableName}}` syntax:

- Variables are extracted from `titleTemplate` and `descriptionPrompt` fields
- When creating from template, provide values in the `variables` object
- Unsubstituted variables remain as-is in the output
- Variable names must be alphanumeric with underscores

Example:
```
Template: "Implement {{featureName}} for {{moduleName}}"
Variables: { "featureName": "Login", "moduleName": "auth" }
Result: "Implement Login for auth"
```

---

## Related Documentation

- [Templates Guide](../MCP/templates.md) - Comprehensive template guide
- [Tools Reference](../MCP/tools-reference.md) - MCP tools for templates
