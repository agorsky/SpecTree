# Implementation Plan Templates

Implementation plan templates provide reusable structures for creating standardized epic/feature/task hierarchies. Templates use `{{variable}}` placeholders that are substituted when creating work items.

---

## Overview

Templates allow you to:

1. **Define standardized workflows** - Create consistent patterns for common work types
2. **Use variable substitution** - Customize templates with `{{variable}}` placeholders
3. **Create full hierarchies** - Generate epics with multiple features and tasks in one operation
4. **Save existing work as templates** - Convert successful patterns into reusable templates

---

## Template Structure

Templates store their structure as JSON with the following schema:

```json
{
  "epicDefaults": {
    "icon": "🚀",
    "color": "#FF5733",
    "descriptionPrompt": "Description hint for the epic"
  },
  "features": [
    {
      "titleTemplate": "{{featureName}} - Design",
      "descriptionPrompt": "Describe the design approach",
      "executionOrder": 1,
      "canParallelize": false,
      "tasks": [
        {
          "titleTemplate": "Create design document for {{featureName}}",
          "descriptionPrompt": "What should the design document contain?",
          "executionOrder": 1
        }
      ]
    }
  ]
}
```

### Key Fields

| Field | Description |
|-------|-------------|
| `titleTemplate` | Title with `{{variable}}` placeholders |
| `descriptionPrompt` | Hint for what the description should contain (optional) |
| `executionOrder` | Suggested order within parent (1-based) |
| `canParallelize` | Whether this feature can run alongside others |
| `tasks` | Nested tasks for each feature (optional) |

---

## Variable Substitution

Templates use `{{variableName}}` syntax for placeholders:

```
"titleTemplate": "Implement {{featureName}} for {{moduleName}}"
```

When creating from template with:
```json
{
  "variables": {
    "featureName": "OAuth Login",
    "moduleName": "auth"
  }
}
```

Results in: `"Implement OAuth Login for auth"`

### Variable Rules

- Variable names must be alphanumeric with underscores: `{{valid_name}}`
- Unsubstituted variables remain as-is: `{{unknown}}` → `{{unknown}}`
- Variables can appear in titles, descriptions, and prompts

---

## Built-in Templates

SpecTree includes four built-in templates covering common development workflows:

### 1. Code Feature

Standard feature implementation workflow:

| Feature | Description |
|---------|-------------|
| Design | Architecture, documentation |
| Implementation | Core coding work |
| Testing | Unit, integration tests |
| Documentation | User and API docs |

Variables: `{{featureName}}`

### 2. Bug Fix

Bug investigation and resolution:

| Feature | Description |
|---------|-------------|
| Investigation | Identify root cause |
| Reproduce | Create failing test |
| Fix | Implement solution |
| Verify | Test and regression check |

Variables: `{{bugTitle}}`, `{{component}}`

### 3. Refactoring

Code refactoring workflow:

| Feature | Description |
|---------|-------------|
| Analysis | Identify scope and impact |
| Implementation | Incremental changes |
| Testing | Verify behavior unchanged |

Variables: `{{refactoringTarget}}`

### 4. API Endpoint

New API endpoint development:

| Feature | Description |
|---------|-------------|
| Design | Contract, authentication |
| Implementation | Route, service, validation |
| Testing | Unit, integration, e2e |
| Documentation | OpenAPI, usage examples |

Variables: `{{endpointName}}`, `{{resource}}`

---

## MCP Tools

### List Templates

```
spectree__list_templates({ builtInOnly: false })
```

Returns all available templates with:
- Name and description
- Whether it's a built-in template
- Variable names required

### Preview Template

```
spectree__preview_template({
  templateName: "Code Feature",
  epicName: "User Authentication",
  variables: { featureName: "OAuth Login" }
})
```

Returns preview of what will be created without creating anything.

### Create from Template

```
spectree__create_from_template({
  templateName: "Code Feature",
  epicName: "User Authentication",
  team: "Backend",
  variables: { featureName: "OAuth Login" }
})
```

Creates the full hierarchy and returns:
- Epic details (name, ID)
- Features with identifiers
- Tasks with identifiers
- Summary counts

### Save as Template

```
spectree__save_as_template({
  epicId: "epic-uuid",
  templateName: "My Workflow",
  description: "Custom workflow for my team"
})
```

Converts an existing epic's structure into a reusable template.

---

## REST API Endpoints

Templates are also available via the REST API:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/templates` | List all templates |
| GET | `/api/v1/templates/:id` | Get template details |
| POST | `/api/v1/templates` | Create new template |
| PATCH | `/api/v1/templates/:id` | Update template |
| DELETE | `/api/v1/templates/:id` | Delete template |
| POST | `/api/v1/templates/:id/preview` | Preview template |
| POST | `/api/v1/templates/:id/create` | Create from template |
| POST | `/api/v1/templates/save-from-epic` | Save epic as template |

All endpoints except listing require authentication.

---

## Best Practices

### Designing Templates

1. **Keep variables meaningful** - Use descriptive names like `{{moduleName}}` not `{{x}}`
2. **Include execution order** - Helps AI agents understand workflow sequence
3. **Add description prompts** - Guides users on what each item should contain
4. **Set canParallelize** - Mark features that can run concurrently

### Using Templates

1. **Preview first** - Always preview before creating to verify variable substitution
2. **Provide all variables** - Missing variables appear as `{{variableName}}` in output
3. **Check team exists** - Team must exist and not be archived

### Saving Templates

1. **Clean up first** - Remove project-specific details from titles/descriptions
2. **Add placeholders** - Replace specific names with `{{variable}}` patterns
3. **Document variables** - Use clear variable names that explain expected values

---

## Related Documentation

- [Tools Reference](./tools-reference.md) - All MCP tools
- [Execution Metadata](./execution-metadata.md) - Execution planning
- [Progress Tracking](./progress-tracking.md) - Progress tracking tools
