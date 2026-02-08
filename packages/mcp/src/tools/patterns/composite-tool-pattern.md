# Composite Tool Interface Pattern

## Problem Statement

SpecTree's MCP server initially had **83 individual tools**, which created several issues:
- **High token usage**: Each tool definition consumes tokens in the AI context window
- **Cognitive overhead**: AI agents must scan through many similar tools to find the right one
- **Redundant patterns**: Many tools share common error handling, validation, and response formatting
- **Sequential workflows**: Common operations required 15-30 sequential tool calls

**Goal**: Consolidate related operations into ~25 composite tools while maintaining clear, AI-friendly parameter guidance.

## Solution: Action-Based Routing with Zod Discriminated Unions

Instead of having separate tools for each operation, we create **composite tools** that group related operations behind an `action` parameter. Zod's `discriminatedUnion()` enables type-safe routing where each action has its own parameter schema.

### Key Benefits

1. **Reduced Token Usage**: One tool definition instead of multiple similar tools
2. **Better AI Guidance**: Each action clearly shows its required parameters
3. **Grouped Operations**: Related functionality is discoverable in one place
4. **Atomic Workflows**: Composite tools can execute multi-step operations atomically

## Action Parameter Pattern

The pattern uses an `action` discriminator to route to different operations:

```typescript
import { z } from "zod";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    name: z.string(),
    description: z.string().optional(),
  }),
  z.object({
    action: z.literal("update"),
    id: z.string(),
    name: z.string().optional(),
  }),
  z.object({
    action: z.literal("delete"),
    id: z.string(),
  }),
]);
```

**Why discriminated unions?**
- AI agents see parameter requirements **per action**
- Type safety ensures correct parameters for each action
- Clear error messages when parameters are missing
- Single source of truth for validation

## Before/After Example

### Before: 3 Separate Tools

```typescript
// Tool 1: create_project
server.registerTool(
  "create_project",
  {
    description: "Create a new project",
    inputSchema: {
      name: z.string(),
      description: z.string().optional(),
    },
  },
  async (input) => {
    // Create logic
  }
);

// Tool 2: update_project
server.registerTool(
  "update_project",
  {
    description: "Update an existing project",
    inputSchema: {
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
    },
  },
  async (input) => {
    // Update logic
  }
);

// Tool 3: delete_project
server.registerTool(
  "delete_project",
  {
    description: "Delete a project",
    inputSchema: {
      id: z.string(),
    },
  },
  async (input) => {
    // Delete logic
  }
);
```

**Token cost**: 3 tool definitions × ~150 tokens each = ~450 tokens

### After: 1 Composite Tool

```typescript
import { z } from "zod";

const projectSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    name: z.string().describe("Project name (required)"),
    description: z.string().optional().describe("Optional project description"),
  }),
  z.object({
    action: z.literal("update"),
    id: z.string().describe("Project ID to update"),
    name: z.string().optional().describe("New name (optional)"),
    description: z.string().optional().describe("New description (optional)"),
  }),
  z.object({
    action: z.literal("delete"),
    id: z.string().describe("Project ID to delete"),
  }),
]);

server.registerTool(
  "manage_project",
  {
    description:
      "Manage projects with action-based routing.\n\n" +
      "Actions:\n" +
      "- 'create': Create a new project with name and optional description\n" +
      "- 'update': Update an existing project's name or description\n" +
      "- 'delete': Delete a project by ID\n\n" +
      "Use the 'action' parameter to specify which operation to perform. " +
      "Each action has its own required parameters shown in the schema.",
    inputSchema: projectSchema,
  },
  async (input) => {
    try {
      // Route to appropriate handler based on action
      switch (input.action) {
        case "create":
          return await createProject(input.name, input.description);
        case "update":
          return await updateProject(input.id, input.name, input.description);
        case "delete":
          return await deleteProject(input.id);
        default:
          // TypeScript ensures this is unreachable
          throw new Error(`Unknown action: ${(input as any).action}`);
      }
    } catch (error) {
      return createErrorResponse(error);
    }
  }
);
```

**Token cost**: 1 tool definition × ~200 tokens = ~200 tokens (55% reduction)

## Error Handling Patterns

Composite tools should handle errors consistently:

```typescript
async (input) => {
  try {
    // Action routing
    switch (input.action) {
      case "someAction":
        const result = await performAction(input);
        return createResponse({
          success: true,
          message: "Action completed successfully",
          data: result,
        });
      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  } catch (error) {
    // Centralized error handling
    if (error instanceof ApiError) {
      if (error.status === 404) {
        return createErrorResponse(
          new Error(`Resource not found: ${input.id}`)
        );
      }
      if (error.status === 403) {
        return createErrorResponse(
          new Error("Access denied. Check permissions.")
        );
      }
    }
    
    // Generic fallback
    return createErrorResponse(error);
  }
}
```

### Error Response Format

Use consistent error responses across all tools:

```typescript
{
  content: [
    {
      type: "text",
      text: "Error: Resource not found: abc-123"
    }
  ],
  isError: true
}
```

## Response Formatting

Provide structured, consistent responses:

```typescript
// Success response
return createResponse({
  message: "Project created successfully",
  project: {
    id: "abc-123",
    name: "New Project",
    description: "A new project",
    createdAt: "2024-02-08T12:00:00Z",
  },
});

// List response
return createResponse({
  message: "Found 5 projects",
  projects: [...],
  pagination: {
    total: 5,
    cursor: null,
  },
});
```

## Real-World Example: SpecTree Composite Tools

### spectree__create_epic_complete

This composite tool replaces a workflow that previously required 15-30 sequential calls:

**Old workflow**:
1. `create_epic` (1 call)
2. `create_feature` × N features (N calls)
3. `create_task` × M tasks per feature (N×M calls)
4. `set_structured_description` × (N + N×M) calls
5. `set_execution_metadata` × (N + N×M) calls

**Total**: ~20-30 calls for a typical implementation plan

**New workflow**:
1. `create_epic_complete` (1 atomic call)

The composite tool:
- Creates the entire hierarchy in one transaction
- Automatically resolves dependencies by index
- Sets execution metadata for all items
- Returns all created IDs and identifiers

This is **not** action-based routing (it's a single atomic operation), but demonstrates the **atomic workflow** benefit of composite tools.

### spectree__complete_task_with_validation

This composite tool combines validation + completion:

**Old workflow**:
1. `run_all_validations` (1 call)
2. Check results manually
3. `complete_work` (1 call)

**New workflow**:
1. `complete_task_with_validation` (1 call)

The tool automatically:
- Runs all validation checks
- Only completes if validations pass
- Returns detailed failure info if validations fail
- Handles tasks with no validations gracefully

## When to Use Composite Tools

### ✅ Good Use Cases

- **CRUD operations**: Create, Read, Update, Delete for the same resource type
- **Workflow operations**: Start, pause, resume, complete a process
- **Atomic transactions**: Multi-step operations that should succeed or fail together
- **Related queries**: Different ways to filter or search the same data

### ❌ Avoid When

- **Operations are unrelated**: Don't group dissimilar operations just to reduce tool count
- **Different permissions**: Actions requiring different authorization levels
- **Significantly different return types**: Actions that return completely different data structures
- **Performance concerns**: Very heavy operations that timeout when combined

## Testing Strategy

Testing composite tools requires a comprehensive approach that validates each action independently while also testing the complete workflow. Follow these five testing patterns:

### 1. Test Each Action in Isolation

**Purpose**: Verify that each action works correctly with its specific parameters.

**Pattern**: Create a test suite per action with multiple test cases covering:
- Required parameters only
- Optional parameters
- Different parameter combinations
- Edge cases (empty strings, boundary values, etc.)

**Example**:
```typescript
describe("manage_project composite tool", () => {
  describe("action: create", () => {
    it("creates a project with name only", async () => {
      const result = await tool({
        action: "create",
        name: "Test Project",
      });
      expect(result.project.name).toBe("Test Project");
    });

    it("creates a project with description", async () => {
      const result = await tool({
        action: "create",
        name: "Test Project",
        description: "A test project",
      });
      expect(result.project.description).toBe("A test project");
    });
    
    it("validates required name parameter", async () => {
      await expect(
        tool({ action: "create" })
      ).rejects.toThrow(/name.*required/i);
    });
  });

  describe("action: update", () => {
    it("updates project name", async () => {
      const result = await tool({
        action: "update",
        id: "existing-id",
        name: "Updated Name",
      });
      expect(result.project.name).toBe("Updated Name");
    });
  });

  describe("action: delete", () => {
    it("deletes a project", async () => {
      const result = await tool({
        action: "delete",
        id: "existing-id",
      });
      expect(result.success).toBe(true);
    });
  });
});
```

### 2. Test Invalid Action Handling

**Purpose**: Ensure the tool gracefully handles unknown or invalid actions.

**Pattern**: Test that invalid actions are rejected with clear error messages. This prevents runtime errors when the discriminated union receives unexpected input.

**Example**:
```typescript
describe("invalid action handling", () => {
  it("rejects unknown actions", async () => {
    const result = await tool({
      action: "invalid",
      id: "test",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Unknown action");
  });
  
  it("lists available actions in error message", async () => {
    const result = await tool({
      action: "nonexistent",
      name: "test",
    });
    expect(result.content[0].text).toMatch(/available actions.*create.*update.*delete/i);
  });
});
```

### 3. Test Parameter Validation Per Action

**Purpose**: Verify that Zod's schema validation correctly enforces required parameters for each action.

**Pattern**: Test missing required parameters, wrong parameter types, and invalid values for each action independently.

**Example**:
```typescript
describe("parameter validation", () => {
  describe("action: create", () => {
    it("validates required parameters for create", async () => {
      // Missing required 'name' parameter
      await expect(
        tool({ action: "create" })
      ).rejects.toThrow(/name.*required/i);
    });
    
    it("rejects invalid parameter types", async () => {
      await expect(
        tool({ action: "create", name: 123 }) // name should be string
      ).rejects.toThrow();
    });
  });

  describe("action: update", () => {
    it("validates required parameters for update", async () => {
      // Missing required 'id' parameter
      await expect(
        tool({ action: "update", name: "Test" })
      ).rejects.toThrow(/id.*required/i);
    });
  });
});
```

### 4. Integration Tests for End-to-End Workflows

**Purpose**: Test complete workflows that use multiple actions in sequence, simulating real-world usage patterns.

**Pattern**: Create, modify, and clean up resources in a single test to verify the entire lifecycle works correctly.

**Example**:
it("supports full CRUD lifecycle", async () => {
  // Create
  const created = await tool({
    action: "create",
    name: "Test Project",
  });
  const projectId = created.project.id;

  // Update
  const updated = await tool({
    action: "update",
    id: projectId,
    name: "Updated Project",
  });
  expect(updated.project.name).toBe("Updated Project");

  // Delete
  const deleted = await tool({
    action: "delete",
    id: projectId,
  });
  expect(deleted.success).toBe(true);
});
```

### 5. Test Error Handling

**Purpose**: Ensure the tool handles various error conditions gracefully and returns helpful error messages.

**Pattern**: Test common error scenarios like missing resources (404), permission issues (403), validation failures, and API errors.

**Example**:
```typescript
describe("error handling", () => {
  it("handles 404 errors gracefully", async () => {
    const result = await tool({
      action: "update",
      id: "non-existent-id",
      name: "Test",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  it("handles validation errors", async () => {
    const result = await tool({
      action: "create",
      name: "", // Invalid empty name
    });
    expect(result.isError).toBe(true);
  });
  
  it("handles API timeouts", async () => {
    // Mock slow API response
    const result = await tool({
      action: "create",
      name: "Test",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/timeout|timed out/i);
  });
  
  it("handles permission errors", async () => {
    const result = await tool({
      action: "delete",
      id: "protected-resource-id",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/permission|access denied/i);
  });
});
```

## Summary: 5-Step Testing Pattern for Composite Tools

For every composite tool, follow these 5 testing patterns in order:

1. **Isolation Tests**: Test each action independently with valid inputs
2. **Invalid Action Tests**: Verify unknown actions are rejected
3. **Validation Tests**: Test parameter validation per action
4. **Integration Tests**: Test complete workflows using multiple actions
5. **Error Handling Tests**: Test various error conditions

This comprehensive approach ensures composite tools are robust, maintainable, and provide clear feedback for both AI agents and developers.

## Implementation Checklist

When creating a composite tool:

- [ ] Use `z.discriminatedUnion("action", [...])` for action routing
- [ ] Provide clear descriptions for each action in the tool description
- [ ] Add `.describe()` to each parameter for AI guidance
- [ ] Implement consistent error handling with `createErrorResponse()`
- [ ] Return structured responses with `createResponse()`
- [ ] Write tests for each action independently
- [ ] Test invalid action handling
- [ ] Test parameter validation per action
- [ ] Document the tool in help.ts if user-facing
- [ ] Measure token savings with `measure-tool-tokens.ts`

## Migration Guide

To convert existing tools to composites:

1. **Identify related tools**: Group by resource type or workflow
2. **Design action names**: Use clear verbs (create, update, delete, list, get)
3. **Build discriminated union**: One object per action with its parameters
4. **Consolidate handlers**: Move existing logic into action switch
5. **Update tests**: Restructure to test per action
6. **Update documentation**: Update help text and examples
7. **Measure impact**: Run token measurement before/after

## Token Measurement

Use the `measure-tool-tokens.ts` script to quantify improvements:

```bash
# Before consolidation
npm run measure-tokens -- --output baseline.json

# After consolidation
npm run measure-tokens -- --output after.json

# Compare
npm run measure-tokens -- --compare baseline.json after.json
```

Expected savings: **40-60% token reduction** when consolidating 3-5 tools into one composite.

## Conclusion

The action-based composite tool pattern provides:
- **Lower token costs** through consolidation
- **Better AI UX** with clear parameter guidance per action
- **Maintainability** through shared error handling and validation
- **Atomic operations** for complex workflows

This pattern is the foundation for scaling SpecTree's MCP interface while keeping it AI-friendly and efficient.
