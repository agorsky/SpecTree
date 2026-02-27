# Decision Log

The Decision Log provides an append-only record of implementation decisions, preserving the rationale behind choices made during development. This creates an audit trail that future sessions can reference to understand why specific approaches were taken.

## Why Log Decisions?

- **Context Preservation**: Future AI sessions can understand past reasoning
- **Avoid Re-debate**: Prevents revisiting already-decided issues
- **Accountability**: Clear record of who decided what and when
- **Learning**: Accumulate institutional knowledge over time

## When to Log Decisions

Log a decision when:
- Choosing between multiple libraries or approaches
- Deciding to skip or defer something
- Making assumptions about requirements
- Changing direction from the original plan
- Acknowledging explicit tradeoffs

## MCP Tools

### `dispatcher__log_decision`

Record a new decision with its rationale.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `epicId` | UUID | ✅ | Epic this decision relates to |
| `featureId` | UUID | | Feature this decision relates to |
| `taskId` | UUID | | Task this decision relates to |
| `question` | string | ✅ | What was being decided |
| `decision` | string | ✅ | The choice that was made |
| `rationale` | string | ✅ | Why this choice was made |
| `alternatives` | string[] | | Other options considered |
| `madeBy` | string | | Who made the decision (default: "AI") |
| `category` | enum | | Decision category |
| `impact` | enum | | Impact level |

**Categories:**
- `architecture` - System design decisions
- `library` - Package/dependency choices
- `approach` - Implementation strategy
- `scope` - Feature inclusion/exclusion
- `design` - UI/UX decisions
- `tradeoff` - Explicit tradeoff acknowledgment
- `deferral` - Postponed decisions

**Impact Levels:**
- `low` - Minor impact, easily reversible
- `medium` - Moderate impact, some effort to change
- `high` - Major impact, significant effort to reverse

**Example:**
```typescript
await dispatcher__log_decision({
  epicId: "550e8400-e29b-41d4-a716-446655440000",
  featureId: "optional-feature-uuid",
  question: "Which state management library to use?",
  decision: "Use Zustand instead of Redux",
  rationale: "Zustand has a simpler API, smaller bundle size, and sufficient features for our use case. Redux would be overkill.",
  alternatives: ["Redux", "MobX", "Jotai"],
  category: "library",
  impact: "medium"
});
```

### `dispatcher__list_decisions`

Get decisions filtered by context.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `epicId` | UUID | Filter by epic |
| `featureId` | UUID | Filter by feature |
| `taskId` | UUID | Filter by task |
| `category` | enum | Filter by category |
| `impact` | enum | Filter by impact level |
| `limit` | number | Max results (default: 20, max: 100) |
| `cursor` | string | Pagination cursor |

**Example:**
```typescript
// Get all architecture decisions for an epic
const { decisions } = await dispatcher__list_decisions({
  epicId: "550e8400-e29b-41d4-a716-446655440000",
  category: "architecture"
});
```

### `dispatcher__search_decisions`

Find decisions by searching question, decision, and rationale text.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | ✅ | Search query |
| `epicId` | UUID | | Limit to specific epic |
| `limit` | number | | Max results (default: 20) |
| `cursor` | string | | Pagination cursor |

**Example:**
```typescript
// Find all decisions about authentication
const { decisions } = await dispatcher__search_decisions({
  query: "authentication"
});
```

### `dispatcher__get_decision_context`

Get all decisions related to current work, organized by scope.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `taskId` | string | Task ID or identifier (e.g., "COM-123-1") |
| `featureId` | string | Feature ID or identifier (e.g., "COM-123") |

One of `taskId` or `featureId` is required.

**Returns:**
- For task: task decisions, feature decisions, and epic decisions
- For feature: feature decisions and epic decisions

**Example:**
```typescript
// Get all decisions relevant to current task
const context = await dispatcher__get_decision_context({
  taskId: "COM-123-1"
});
// context.taskDecisions - Decisions for this specific task
// context.featureDecisions - Decisions for the parent feature
// context.epicDecisions - Decisions for the epic
```

## REST API

The Decision Log also provides REST API endpoints:

### Create Decision
```
POST /api/v1/decisions
```

### List Decisions
```
GET /api/v1/decisions?epicId=...&category=...&impact=...
```

### Search Decisions
```
GET /api/v1/decisions/search?query=...&epicId=...
```

### Get Single Decision
```
GET /api/v1/decisions/:id
```

### Get Task Decision Context
```
GET /api/v1/decisions/context/task/:taskId
```

### Get Feature Decision Context
```
GET /api/v1/decisions/context/feature/:featureId
```

## Best Practices

1. **Be specific about the question**: Clearly state what was being decided, not just the outcome.

2. **Document alternatives**: List what else was considered, even briefly.

3. **Include context**: Explain any constraints or requirements that influenced the decision.

4. **Use appropriate categories**: This helps with filtering and understanding decision types.

5. **Set impact correctly**: Helps prioritize which decisions to review first.

6. **Link to the right scope**: Associate decisions with the most specific scope (task > feature > epic).

## Data Model

Decisions have the following structure:

```typescript
interface Decision {
  id: string;
  epicId: string;           // Required - all decisions belong to an epic
  featureId?: string;       // Optional - for feature-specific decisions
  taskId?: string;          // Optional - for task-specific decisions
  question: string;         // What was being decided
  decision: string;         // The choice made
  rationale: string;        // Why this choice was made
  alternatives?: string[];  // Other options considered
  madeBy: string;          // Who made the decision
  madeAt: string;          // When the decision was made
  category?: string;       // Decision category
  impact?: string;         // Impact level
  createdAt: string;
  updatedAt: string;
}
```

Decisions are **append-only** - once created, they cannot be modified or deleted. This ensures a complete audit trail of all decisions made during development.
