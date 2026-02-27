# Execution Metadata for AI Agents

This document describes the execution metadata fields available on Features and Tasks that help AI agents understand task ordering, dependencies, and parallelization opportunities.

## Overview

Dispatcher supports execution metadata on both Features and Tasks to enable intelligent work planning. AI agents can use this metadata to:

1. Understand the suggested order of work
2. Identify which items can run in parallel
3. Know dependencies that must complete first
4. Estimate effort based on complexity ratings

## Execution Metadata Fields

Both Features and Tasks support these fields:

| Field | Type | Description |
|-------|------|-------------|
| `executionOrder` | Integer (positive) | Suggested execution sequence (1, 2, 3...). Lower numbers are worked on first. Items without an order are processed after numbered items. |
| `canParallelize` | Boolean | Whether this item can run alongside other items. Default: `false` |
| `parallelGroup` | String (max 100) | Group identifier for items that can run together. Items in the same group with `canParallelize=true` will be scheduled in the same execution phase. |
| `dependencies` | Array of UUIDs | Feature/Task IDs that must complete before this item. The execution plan ensures dependencies are in earlier phases. |
| `estimatedComplexity` | Enum | Effort estimate: `trivial` (< 1 hour), `simple` (1-4 hours), `moderate` (1-3 days), `complex` (> 3 days) |

## MCP Tools

### dispatcher__get_execution_plan

Returns an ordered execution plan for features in an epic.

**Input:**
```json
{
  "epicId": "epic-uuid-or-name"
}
```

**Output:**
```json
{
  "epicId": "uuid",
  "phases": [
    {
      "order": 1,
      "items": [
        {
          "type": "feature",
          "id": "uuid",
          "identifier": "COM-1",
          "title": "First Feature",
          "executionOrder": 1,
          "canParallelize": false,
          "parallelGroup": null,
          "dependencies": [],
          "estimatedComplexity": "simple"
        }
      ],
      "canRunInParallel": false,
      "estimatedComplexity": "simple"
    },
    {
      "order": 2,
      "items": [
        {
          "type": "feature",
          "id": "uuid",
          "identifier": "COM-2",
          "title": "Parallel Feature A",
          "canParallelize": true,
          "parallelGroup": "group-1",
          "dependencies": ["first-feature-uuid"],
          "estimatedComplexity": "moderate"
        },
        {
          "type": "feature",
          "id": "uuid",
          "identifier": "COM-3",
          "title": "Parallel Feature B",
          "canParallelize": true,
          "parallelGroup": "group-1",
          "dependencies": ["first-feature-uuid"],
          "estimatedComplexity": "simple"
        }
      ],
      "canRunInParallel": true,
      "estimatedComplexity": "moderate"
    }
  ],
  "totalItems": 3
}
```

### dispatcher__set_execution_metadata

Set execution metadata for a feature or task.

**Input:**
```json
{
  "id": "COM-123",
  "type": "feature",
  "executionOrder": 2,
  "canParallelize": true,
  "parallelGroup": "backend-work",
  "dependencies": ["uuid-of-dependency"],
  "estimatedComplexity": "moderate"
}
```

### dispatcher__mark_blocked

Mark a feature or task as blocked by another item.

**Input:**
```json
{
  "id": "COM-123",
  "type": "feature",
  "blockedById": "uuid-of-blocker"
}
```

### dispatcher__mark_unblocked

Remove a blocker from a feature or task.

**Input:**
```json
{
  "id": "COM-123",
  "type": "feature",
  "unblockedFromId": "uuid-to-remove"
}
```

## API Endpoints

The execution metadata fields are available on existing feature and task endpoints:

### Create Feature
```http
POST /api/v1/features
Content-Type: application/json

{
  "title": "New Feature",
  "epicId": "uuid",
  "executionOrder": 1,
  "canParallelize": false,
  "dependencies": [],
  "estimatedComplexity": "simple"
}
```

### Update Feature
```http
PUT /api/v1/features/:id
Content-Type: application/json

{
  "executionOrder": 2,
  "canParallelize": true,
  "parallelGroup": "api-work",
  "dependencies": ["dep-uuid-1", "dep-uuid-2"],
  "estimatedComplexity": "moderate"
}
```

Task endpoints (`/api/v1/tasks`) support the same fields.

## Execution Plan Algorithm

The execution plan is generated using the following algorithm:

1. **Fetch all items** for the epic
2. **Sort by executionOrder** (nulls at end)
3. **Build phases using topological sort:**
   - Items with no dependencies or all dependencies satisfied go first
   - Circular dependencies are handled by including remaining items
4. **Group by parallelGroup:**
   - Items with the same `parallelGroup` and `canParallelize=true` are placed in the same phase
   - Items without `canParallelize` get their own phase
5. **Calculate phase complexity:**
   - Uses the highest complexity from items in the phase

## Example Usage

### Setting up a work plan

```typescript
// Create features with execution metadata
await createFeature({
  title: "Database Schema",
  epicId: "my-epic",
  executionOrder: 1,
  estimatedComplexity: "simple"
});

await createFeature({
  title: "API Endpoints",
  epicId: "my-epic",
  executionOrder: 2,
  dependencies: [dbSchemaFeatureId],
  canParallelize: true,
  parallelGroup: "backend",
  estimatedComplexity: "moderate"
});

await createFeature({
  title: "Service Layer",
  epicId: "my-epic",
  executionOrder: 2,
  dependencies: [dbSchemaFeatureId],
  canParallelize: true,
  parallelGroup: "backend",
  estimatedComplexity: "moderate"
});

await createFeature({
  title: "Frontend Integration",
  epicId: "my-epic",
  executionOrder: 3,
  dependencies: [apiFeatureId, serviceFeatureId],
  estimatedComplexity: "complex"
});
```

### Getting the execution plan

```typescript
const plan = await getExecutionPlan({ epicId: "my-epic" });

// Result:
// Phase 1: Database Schema (no parallel)
// Phase 2: API Endpoints + Service Layer (parallel)
// Phase 3: Frontend Integration (no parallel)
```

## AI Agent Best Practices

1. **Call `dispatcher__get_instructions` first** to learn about all available capabilities
2. **Call get_execution_plan** to understand the work order before starting
3. **Respect dependencies** - don't start items until dependencies are complete
4. **Use parallel groups** when multiple independent items can be worked on
5. **Update complexity** as you learn more about the actual effort required
6. **Mark blockers** as you discover them during implementation

## Discovering Capabilities

AI agents can call `dispatcher__get_instructions` with different topics:

- `all` - Complete instructions (recommended for first-time setup)
- `execution` - Execution planning and dependencies
- `search` - Filtering and search capabilities
- `workflow` - Recommended work patterns
- `personal` - Personal workspace features
- `overview` - Basic concepts and hierarchy
