# Structured Descriptions

> **⚠️ DEPRECATION NOTICE:**  
> The individual structured description tools (`dispatcher__get_structured_description`, `dispatcher__set_structured_description`, `dispatcher__update_section`, `dispatcher__add_acceptance_criterion`, `dispatcher__link_file`, `dispatcher__add_external_link`) are **DEPRECATED**.  
>  
> **Use instead:** `dispatcher__manage_description` with action-based routing:
> - `action='get'` - Retrieve structured description
> - `action='set'` - Replace entire description
> - `action='update_section'` - Update single section
> - `action='add_criterion'` - Add acceptance criterion
> - `action='link_file'` - Add file to filesInvolved
> - `action='add_link'` - Add external link
>
> See [Tools Reference](./tools-reference.md#dispatcher__manage_description) for complete documentation.

Dispatcher supports rich, structured descriptions for Features and Tasks that enable AI agents to extract and update specific sections without parsing unstructured text.

## Overview

Instead of a single freeform text field, descriptions can now include:
- **Summary**: Brief overview of the work item
- **AI Instructions**: Specific guidance for AI agents working on this item
- **Acceptance Criteria**: List of conditions that must be met
- **Files Involved**: List of file paths relevant to this work
- **Functions to Modify**: Specific functions or methods to change
- **Testing Strategy**: How to test the implementation
- **Test Files**: List of test file paths
- **Related Item IDs**: Links to related Features/Tasks
- **External Links**: URLs to documentation, specs, etc.
- **Technical Notes**: Implementation details, gotchas, or constraints
- **Risk Level**: `low`, `medium`, or `high`
- **Estimated Effort**: `trivial`, `small`, `medium`, `large`, or `xl`

## Schema

```typescript
interface StructuredDescription {
  summary: string;                    // Required
  aiInstructions?: string;
  acceptanceCriteria?: string[];
  filesInvolved?: string[];
  functionsToModify?: string[];
  testingStrategy?: string;
  testFiles?: string[];
  relatedItemIds?: string[];
  externalLinks?: ExternalLink[];
  technicalNotes?: string;
  riskLevel?: 'low' | 'medium' | 'high';
  estimatedEffort?: 'trivial' | 'small' | 'medium' | 'large' | 'xl';
}

interface ExternalLink {
  url: string;
  title?: string;
  description?: string;
}
```

## MCP Tools

### Get Structured Description

Retrieve the parsed structured description from a Feature or Task.

```typescript
dispatcher__get_structured_description({
  id: "COM-123",      // Feature or Task identifier
  type: "feature"     // "feature" or "task"
})
```

Returns the full `StructuredDescription` object or `null` if not set.

### Set Structured Description

Replace the entire structured description (use with caution).

```typescript
dispatcher__set_structured_description({
  id: "COM-123",
  type: "feature",
  structuredDescription: {
    summary: "Implement user authentication flow",
    aiInstructions: "Use the existing auth service pattern",
    acceptanceCriteria: [
      "User can log in with email/password",
      "Invalid credentials show error message"
    ],
    filesInvolved: ["src/auth/login.ts", "src/components/LoginForm.tsx"],
    riskLevel: "medium"
  }
})
```

### Update Section

Update a single section without affecting others. This is the recommended approach for incremental updates.

```typescript
dispatcher__update_section({
  id: "COM-123",
  type: "feature",
  section: "aiInstructions",
  value: "Focus on performance optimization"
})
```

**Supported sections:**
- `summary` (string)
- `aiInstructions` (string)
- `acceptanceCriteria` (string[])
- `filesInvolved` (string[])
- `functionsToModify` (string[])
- `testingStrategy` (string)
- `testFiles` (string[])
- `relatedItemIds` (string[])
- `externalLinks` (ExternalLink[])
- `technicalNotes` (string)
- `riskLevel` ('low' | 'medium' | 'high')
- `estimatedEffort` ('trivial' | 'small' | 'medium' | 'large' | 'xl')

### Add Acceptance Criterion

Append a single acceptance criterion to the list (convenience tool).

```typescript
dispatcher__add_acceptance_criterion({
  id: "COM-123",
  type: "feature",
  criterion: "User receives confirmation email after signup"
})
```

Duplicate criteria are automatically skipped.

### Link File

Add a file path to the filesInvolved list (convenience tool).

```typescript
dispatcher__link_file({
  id: "COM-123",
  type: "feature",
  filePath: "src/services/userService.ts"
})
```

Duplicate paths are automatically skipped.

### Add External Link

Add an external URL reference (convenience tool).

```typescript
dispatcher__add_external_link({
  id: "COM-123",
  type: "feature",
  url: "https://docs.example.com/auth-spec",
  title: "Authentication Specification",
  description: "Detailed requirements document"
})
```

Duplicate URLs are automatically skipped.

## REST API Endpoints

### Features

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/features/:id/structured-description` | Get structured description |
| PUT | `/features/:id/structured-description` | Replace entire structured description |
| PATCH | `/features/:id/structured-description/section` | Update single section |
| POST | `/features/:id/structured-description/acceptance-criteria` | Add acceptance criterion |
| POST | `/features/:id/structured-description/files` | Link a file |
| POST | `/features/:id/structured-description/external-links` | Add external link |

### Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tasks/:id/structured-description` | Get structured description |
| PUT | `/tasks/:id/structured-description` | Replace entire structured description |
| PATCH | `/tasks/:id/structured-description/section` | Update single section |
| POST | `/tasks/:id/structured-description/acceptance-criteria` | Add acceptance criterion |
| POST | `/tasks/:id/structured-description/files` | Link a file |
| POST | `/tasks/:id/structured-description/external-links` | Add external link |

## Best Practices

### For AI Agents

1. **Read before modifying**: Always call `get_structured_description` before making updates to understand current state.

2. **Use convenience tools**: Prefer `add_acceptance_criterion`, `link_file`, and `add_external_link` for appending to lists—they handle duplicates gracefully.

3. **Update sections incrementally**: Use `update_section` instead of `set_structured_description` to avoid accidentally overwriting other sections.

4. **Keep AI instructions actionable**: Include specific guidance like "Use existing pattern from X" or "Avoid modifying Y".

5. **Link relevant files early**: Use `link_file` as you discover relevant files during exploration.

### For Human Users

1. **Set risk level appropriately**: This helps AI agents understand the level of caution required.

2. **Include acceptance criteria**: Clear criteria help both AI and human reviewers verify completion.

3. **Document technical constraints**: Use `technicalNotes` for gotchas, edge cases, or architectural constraints.

## Migration

The `structuredDesc` field is stored as JSON and is optional. Existing Features and Tasks with only a plain `description` field continue to work normally. The two fields are independent:

- `description`: Freeform markdown text (legacy field, still supported)
- `structuredDesc`: Structured JSON object (new field)

You can use either or both fields depending on your needs.
