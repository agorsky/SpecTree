# Template Enhancement Implementation Guide

## Problem Statement

The current Dispatcher template system is too generic. Templates only support basic fields but are missing the critical fields that Dispatcher's own guidelines require AI agents to populate.

### Current Template Schema (packages/api/src/schemas/template.ts)

```typescript
// Task - MISSING: estimatedComplexity, structuredDesc
templateTaskSchema = {
  titleTemplate: string,
  descriptionPrompt?: string,  // Just a hint, not actual content
  executionOrder: number
}

// Feature - MISSING: estimatedComplexity, structuredDesc  
templateFeatureSchema = {
  titleTemplate: string,
  descriptionPrompt?: string,
  executionOrder: number,
  canParallelize?: boolean,
  tasks?: TemplateTask[]
}
```

### What Dispatcher Guidelines REQUIRE

Per `.github/copilot-instructions.md`, every feature/task MUST have:
- `estimatedComplexity` - "trivial", "simple", "moderate", "complex"
- `structuredDesc` with:
  - `summary` (REQUIRED)
  - `acceptanceCriteria` (REQUIRED, min 3 for features, min 2 for tasks)
  - `aiInstructions` (REQUIRED)
  - `filesInvolved`, `riskLevel`, `estimatedEffort` (optional)

---

## Implementation Plan

### Phase 1: Extend Template Schema

**File: `packages/api/src/schemas/template.ts`**

Add these fields to `templateTaskSchema`:

```typescript
export const templateTaskSchema = z.object({
  titleTemplate: z.string().min(1),
  descriptionPrompt: z.string().optional(),
  executionOrder: z.number().int().min(1),
  // NEW FIELDS:
  estimatedComplexity: z.enum(["trivial", "simple", "moderate", "complex"]).optional(),
  structuredDescTemplate: z.object({
    summary: z.string().optional(),  // Can use {{variable}} placeholders
    acceptanceCriteria: z.array(z.string()).optional(),
    aiInstructions: z.string().optional(),
    filesInvolved: z.array(z.string()).optional(),
    riskLevel: z.enum(["low", "medium", "high"]).optional(),
    estimatedEffort: z.enum(["trivial", "small", "medium", "large", "xl"]).optional(),
  }).optional(),
});
```

Add same fields to `templateFeatureSchema`:

```typescript
export const templateFeatureSchema = z.object({
  titleTemplate: z.string().min(1),
  descriptionPrompt: z.string().optional(),
  executionOrder: z.number().int().min(1),
  canParallelize: z.boolean().optional().default(false),
  tasks: z.array(templateTaskSchema).optional(),
  // NEW FIELDS:
  estimatedComplexity: z.enum(["trivial", "simple", "moderate", "complex"]).optional(),
  structuredDescTemplate: z.object({
    summary: z.string().optional(),
    acceptanceCriteria: z.array(z.string()).optional(),
    aiInstructions: z.string().optional(),
    filesInvolved: z.array(z.string()).optional(),
    functionsToModify: z.array(z.string()).optional(),
    technicalNotes: z.string().optional(),
    riskLevel: z.enum(["low", "medium", "high"]).optional(),
    estimatedEffort: z.enum(["trivial", "small", "medium", "large", "xl"]).optional(),
  }).optional(),
});
```

### Phase 2: Update Template Service

**File: `packages/api/src/services/templateService.ts`**

In the `createFromTemplate` function (around line 407-497), update feature and task creation to include the new fields:

1. When creating features, add:
```typescript
estimatedComplexity: featureTemplate.estimatedComplexity ?? null,
structuredDesc: featureTemplate.structuredDescTemplate 
  ? JSON.stringify(substituteVariablesInObject(featureTemplate.structuredDescTemplate, variables))
  : null,
```

2. When creating tasks, add:
```typescript
estimatedComplexity: taskTemplate.estimatedComplexity ?? null,
structuredDesc: taskTemplate.structuredDescTemplate
  ? JSON.stringify(substituteVariablesInObject(taskTemplate.structuredDescTemplate, variables))
  : null,
```

3. Add a helper function to substitute variables in nested objects:
```typescript
function substituteVariablesInObject(obj: Record<string, unknown>, variables: Record<string, string>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = substituteVariables(value, variables);
    } else if (Array.isArray(value)) {
      result[key] = value.map(item => 
        typeof item === 'string' ? substituteVariables(item, variables) : item
      );
    } else if (value && typeof value === 'object') {
      result[key] = substituteVariablesInObject(value as Record<string, unknown>, variables);
    } else {
      result[key] = value;
    }
  }
  return result;
}
```

### Phase 3: Update Seed Data with Better Templates

**File: `packages/api/prisma/seed.ts`**

Replace the generic templates with detailed ones. Here's an example for the "Code Feature" template:

```typescript
const codeFeatureTemplate = {
  epicDefaults: {
    icon: "🚀",
    color: "#3b82f6",
    descriptionPrompt: "Implementation of {{topic}}"
  },
  features: [
    {
      titleTemplate: "Research: {{topic}}",
      descriptionPrompt: "Research existing solutions and patterns for {{topic}}",
      executionOrder: 1,
      canParallelize: false,
      estimatedComplexity: "simple",
      structuredDescTemplate: {
        summary: "Research existing solutions, patterns, and best practices for {{topic}}. Document findings to inform implementation approach.",
        acceptanceCriteria: [
          "Existing codebase patterns documented",
          "Industry best practices identified",
          "Technical approach recommendation written",
          "Risks and considerations noted"
        ],
        aiInstructions: "1. Search the codebase for similar patterns using grep/glob. 2. Review any existing documentation. 3. If needed, use web_search for industry best practices. 4. Create a brief summary of findings and recommended approach.",
        riskLevel: "low",
        estimatedEffort: "small"
      },
      tasks: [
        {
          titleTemplate: "Review existing codebase for {{topic}} patterns",
          executionOrder: 1,
          estimatedComplexity: "trivial",
          structuredDescTemplate: {
            summary: "Search the codebase for existing implementations or patterns related to {{topic}}.",
            acceptanceCriteria: [
              "Searched for relevant keywords in codebase",
              "Documented any existing similar implementations"
            ],
            aiInstructions: "Use grep to search for relevant terms. Check packages/api/src/services/ and packages/api/src/routes/ for similar patterns."
          }
        },
        {
          titleTemplate: "Document research findings for {{topic}}",
          executionOrder: 2,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Compile research findings into a recommendation.",
            acceptanceCriteria: [
              "Findings documented in feature description or AI notes",
              "Recommended approach identified"
            ],
            aiInstructions: "Use dispatcher__append_ai_note to document findings. Include: what patterns exist, what approach is recommended, any risks identified."
          }
        }
      ]
    },
    {
      titleTemplate: "Implement: {{topic}}",
      descriptionPrompt: "Build the core functionality for {{topic}}",
      executionOrder: 2,
      canParallelize: false,
      estimatedComplexity: "moderate",
      structuredDescTemplate: {
        summary: "Implement the core functionality for {{topic}} following the patterns established in research.",
        acceptanceCriteria: [
          "Core logic implemented and working",
          "Error handling added",
          "Code follows existing patterns",
          "No TypeScript errors"
        ],
        aiInstructions: "1. Create/modify necessary files. 2. Follow existing service/route patterns. 3. Add proper error handling using AppError classes. 4. Run pnpm typecheck to verify no errors.",
        riskLevel: "medium",
        estimatedEffort: "medium"
      },
      tasks: [
        {
          titleTemplate: "Create service layer for {{topic}}",
          executionOrder: 1,
          estimatedComplexity: "moderate",
          structuredDescTemplate: {
            summary: "Create or update the service file with business logic for {{topic}}.",
            acceptanceCriteria: [
              "Service file created/updated",
              "Business logic implemented",
              "Proper error handling"
            ],
            aiInstructions: "Create file in packages/api/src/services/. Follow existing service patterns (see featureService.ts as example). Use Prisma for database access."
          }
        },
        {
          titleTemplate: "Create route handlers for {{topic}}",
          executionOrder: 2,
          estimatedComplexity: "moderate",
          structuredDescTemplate: {
            summary: "Create API route handlers that expose {{topic}} functionality.",
            acceptanceCriteria: [
              "Route file created/updated",
              "Zod schemas for validation",
              "Routes registered in index.ts"
            ],
            aiInstructions: "Create file in packages/api/src/routes/. Use Zod for request validation. Register routes in packages/api/src/routes/index.ts."
          }
        },
        {
          titleTemplate: "Add error handling for {{topic}}",
          executionOrder: 3,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Ensure all error cases are handled properly.",
            acceptanceCriteria: [
              "All error paths throw appropriate AppError subclasses",
              "No unhandled promise rejections"
            ],
            aiInstructions: "Use NotFoundError, ValidationError, ConflictError from packages/api/src/errors/. Wrap async operations in try/catch."
          }
        }
      ]
    },
    {
      titleTemplate: "Test: {{topic}}",
      descriptionPrompt: "Write tests for {{topic}}",
      executionOrder: 3,
      canParallelize: false,
      estimatedComplexity: "moderate",
      structuredDescTemplate: {
        summary: "Write comprehensive tests for {{topic}} including unit and integration tests.",
        acceptanceCriteria: [
          "Unit tests for service layer",
          "Integration tests for API routes",
          "Edge cases covered",
          "All tests passing"
        ],
        aiInstructions: "1. Create test file in packages/api/tests/. 2. Use factories from tests/fixtures/factories.ts. 3. Run pnpm test to verify.",
        filesInvolved: ["packages/api/tests/"],
        riskLevel: "low",
        estimatedEffort: "medium"
      },
      tasks: [
        {
          titleTemplate: "Write service tests for {{topic}}",
          executionOrder: 1,
          estimatedComplexity: "moderate",
          structuredDescTemplate: {
            summary: "Create unit tests for the {{topic}} service layer.",
            acceptanceCriteria: [
              "Test file created in packages/api/tests/services/",
              "Happy path tests written",
              "Error case tests written"
            ],
            aiInstructions: "Create test file mirroring service location. Use vitest. See existing tests for patterns."
          }
        },
        {
          titleTemplate: "Write integration tests for {{topic}}",
          executionOrder: 2,
          estimatedComplexity: "moderate",
          structuredDescTemplate: {
            summary: "Create integration tests for {{topic}} API routes.",
            acceptanceCriteria: [
              "Test file created in packages/api/tests/routes/",
              "All endpoints tested",
              "Tests use test database"
            ],
            aiInstructions: "Create test file in tests/routes/. Use supertest pattern from existing tests. Tests automatically use test database."
          }
        }
      ]
    }
  ]
};
```

### Phase 4: Add Domain-Specific Templates

Create these additional templates in seed.ts:

1. **"Dispatcher MCP Tool"** - For adding new MCP tools
   - Features: Schema, Service, Route, MCP Tool, Tests
   - Pre-filled with Dispatcher-specific patterns

2. **"Database Migration"** - For schema changes
   - Features: Design Schema, Create Migration, Update Services, Update Types
   - Includes database safety warnings in aiInstructions

3. **"React Component"** - For frontend work
   - Features: Component Design, Implementation, Styling, Tests
   - Pre-filled with React/Tailwind patterns

4. **"Bug Investigation"** - Enhanced version of Bug Fix
   - More detailed acceptance criteria
   - Specific debugging instructions

---

## Testing the Changes

1. **After schema changes**: Run `pnpm typecheck` to ensure no type errors

2. **After seed changes**: 
   ```bash
   cd packages/api
   npm run db:backup  # Safety first!
   npx prisma db seed
   ```

3. **Verify templates**:
   - Use `dispatcher__list_templates()` to see all templates
   - Use `dispatcher__preview_template({ templateName: "Code Feature", epicName: "Test", variables: { topic: "Test Feature" } })` to preview
   - Verify structured descriptions appear in preview

4. **Create from template and verify**:
   - Create an epic from template
   - Check that features have `estimatedComplexity` set
   - Check that features have `structuredDesc` populated

---

## Files to Modify

1. `packages/api/src/schemas/template.ts` - Add new schema fields
2. `packages/api/src/services/templateService.ts` - Apply new fields during creation
3. `packages/api/prisma/seed.ts` - Update built-in templates with rich content

## Dispatcher Epic to Create

Create an epic "Enhanced Template System" in the Engineering team with features:

1. **Extend Template Schema** (executionOrder: 1, complexity: moderate)
   - Add estimatedComplexity and structuredDescTemplate to schema
   
2. **Update Template Service** (executionOrder: 2, complexity: moderate)
   - Apply new fields during createFromTemplate
   
3. **Update Built-in Templates** (executionOrder: 3, complexity: moderate)
   - Rewrite all 4 built-in templates with rich content
   
4. **Add Domain-Specific Templates** (executionOrder: 4, complexity: moderate)
   - Add Dispatcher MCP Tool, Database Migration, React Component templates

5. **Test & Validate** (executionOrder: 5, complexity: simple)
   - Verify templates work end-to-end

---

## Success Criteria

- [ ] Templates can specify `estimatedComplexity` for features/tasks
- [ ] Templates can specify `structuredDescTemplate` with all fields
- [ ] Variables ({{topic}}) work in structured description fields
- [ ] Built-in templates have actionable, specific content
- [ ] AI agents can create complete, well-documented epics from templates
