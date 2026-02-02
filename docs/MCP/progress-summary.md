# Progress Summary Dashboard

The Progress Summary system provides comprehensive progress summaries and dashboards for understanding project status at a glance. These tools are designed to give AI agents immediate context at the start of a session.

---

## Overview

### Purpose

When starting a new AI session, agents need to quickly understand:
- **What's the current state of the project?**
- **What's blocked and needs attention?**
- **What should I work on next?**
- **What was done recently?**

The Progress Summary tools answer these questions with a single API call.

### Key Benefits

1. **Fast Context Loading** - Single call returns comprehensive project status
2. **Actionable Intelligence** - Pre-sorted lists of blocked items and next actions
3. **Session Continuity** - Integrates with session handoff for context transfer
4. **Cross-Project Visibility** - View blockers and work across all epics

---

## MCP Tools

### spectree__get_progress_summary

Get a comprehensive progress summary for a specific epic.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `epicId` | string | Yes | Epic ID (UUID) or exact name |

**Response Structure:**

```typescript
interface ProgressSummary {
  // Epic identification
  epic: {
    id: string;
    name: string;
    description: string | null;
  };
  
  // Feature statistics
  featureCounts: {
    total: number;
    completed: number;
    inProgress: number;
    blocked: number;
  };
  
  // Task statistics  
  taskCounts: {
    total: number;
    completed: number;
    inProgress: number;
    blocked: number;
  };
  
  // Overall metrics
  metrics: {
    overallProgress: number;      // 0-100 percentage
    estimatedRemaining: string;   // Human-readable estimate
  };
  
  // Items requiring attention
  blockedItems: BlockedItem[];
  
  // Next items to work on
  nextActionable: ActionableItem[];
  
  // Recently finished items
  recentlyCompleted: RecentlyCompletedItem[];
  
  // Previous session context (if available)
  lastSession: LastSessionSummary | null;
}
```

**Example Usage:**

```typescript
// At session start
const summary = await spectree__get_progress_summary({ 
  epicId: "Authentication Overhaul" 
});

console.log(`Progress: ${summary.metrics.overallProgress}%`);
console.log(`Blocked items: ${summary.blockedItems.length}`);
console.log(`Next actionable: ${summary.nextActionable.length}`);
```

---

### spectree__get_my_work

Get all work items assigned to the current user across all accessible epics.

**Parameters:** None (uses authenticated user context)

**Response Structure:**

```typescript
interface MyWorkResponse {
  items: MyWorkItem[];
  counts: {
    inProgress: number;
    blocked: number;
    todo: number;
    total: number;
  };
}

interface MyWorkItem {
  id: string;
  type: "feature" | "task";
  identifier: string;        // e.g., "COM-123" or "COM-123-1"
  title: string;
  status: string;
  statusCategory: string;    // "started", "backlog", etc.
  epicId: string;
  epicName: string;
  blockerReason: string | null;
  updatedAt: string;
}
```

**Example Usage:**

```typescript
// Check my current assignments
const myWork = await spectree__get_my_work();

console.log(`In progress: ${myWork.counts.inProgress}`);
console.log(`Blocked: ${myWork.counts.blocked}`);
console.log(`To do: ${myWork.counts.todo}`);

// Find my blocked items
const blocked = myWork.items.filter(i => i.blockerReason);
```

---

### spectree__get_blocked_summary

Get all blocked items across all accessible epics, grouped by epic.

**Parameters:** None (uses authenticated user context)

**Response Structure:**

```typescript
interface BlockedSummaryResponse {
  items: BlockedSummaryItem[];
  byEpic: EpicBlockedCount[];
  total: number;
}

interface BlockedSummaryItem {
  id: string;
  type: "feature" | "task";
  identifier: string;
  title: string;
  epicId: string;
  epicName: string;
  blockerReason: string;
  blockedSince: string | null;
}

interface EpicBlockedCount {
  epicId: string;
  epicName: string;
  count: number;
}
```

**Example Usage:**

```typescript
// Get all blockers across projects
const blockers = await spectree__get_blocked_summary();

console.log(`Total blocked items: ${blockers.total}`);

// Show blockers by epic
for (const epic of blockers.byEpic) {
  console.log(`${epic.epicName}: ${epic.count} blocked`);
}
```

---

## API Endpoints

The MCP tools use these underlying REST endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/epics/:id/progress-summary` | GET | Get progress summary for epic |
| `/api/v1/me/work` | GET | Get current user's work items |
| `/api/v1/me/blocked` | GET | Get all blocked items |

---

## Recommended Workflows

### Session Start Pattern

```typescript
// 1. Get progress summary for the epic you're working on
const summary = await spectree__get_progress_summary({ epicId: "My Epic" });

// 2. Check if there are blockers needing attention
if (summary.blockedItems.length > 0) {
  console.log("⚠️ Blocked items need attention:");
  summary.blockedItems.forEach(item => {
    console.log(`  - ${item.identifier}: ${item.blockerReason}`);
  });
}

// 3. Check what was done recently for context
if (summary.recentlyCompleted.length > 0) {
  console.log("✅ Recently completed:");
  summary.recentlyCompleted.forEach(item => {
    console.log(`  - ${item.identifier}: ${item.title}`);
  });
}

// 4. Review last session context if available
if (summary.lastSession) {
  console.log("📋 Previous session summary:");
  console.log(summary.lastSession.summary);
  
  if (summary.lastSession.nextSteps.length > 0) {
    console.log("🎯 Recommended next steps:");
    summary.lastSession.nextSteps.forEach(step => console.log(`  - ${step}`));
  }
}

// 5. Pick next actionable item
if (summary.nextActionable.length > 0) {
  const next = summary.nextActionable[0];
  console.log(`▶️ Starting work on: ${next.identifier}`);
  await spectree__start_work({ id: next.id, type: next.type });
}
```

### Daily Standup Pattern

```typescript
// Get personal work summary
const myWork = await spectree__get_my_work();

console.log("📊 My Work Summary:");
console.log(`  In Progress: ${myWork.counts.inProgress}`);
console.log(`  Blocked: ${myWork.counts.blocked}`);
console.log(`  To Do: ${myWork.counts.todo}`);

// Report blocked items
if (myWork.counts.blocked > 0) {
  console.log("\n⚠️ Blocked Items:");
  myWork.items
    .filter(i => i.blockerReason)
    .forEach(item => {
      console.log(`  - ${item.identifier}: ${item.blockerReason}`);
    });
}
```

### Cross-Project Blocker Review

```typescript
// Get all blockers across projects
const blockers = await spectree__get_blocked_summary();

console.log(`🚫 Total Blocked: ${blockers.total}`);

if (blockers.total > 0) {
  console.log("\nBy Epic:");
  blockers.byEpic.forEach(epic => {
    console.log(`  ${epic.epicName}: ${epic.count}`);
  });
  
  console.log("\nDetails:");
  blockers.items.forEach(item => {
    console.log(`  ${item.identifier} (${item.epicName})`);
    console.log(`    → ${item.blockerReason}`);
  });
}
```

---

## Integration with Other Tools

### Session Handoff

The progress summary integrates with the [Session Handoff](./session-handoff.md) system:

- `lastSession` field contains previous session summary
- Includes `nextSteps` recommendations from previous session
- Provides continuity between AI sessions

### Execution Planning

Use with [Execution Planning](./execution-metadata.md) tools:

```typescript
// Get summary first
const summary = await spectree__get_progress_summary({ epicId });

// Then get detailed execution plan for ordering work
const plan = await spectree__get_execution_plan({ epicId });
```

### AI Context

Complements [AI Context](./ai-session-context.md) for individual items:

```typescript
// Summary shows what to work on
const summary = await spectree__get_progress_summary({ epicId });
const nextItem = summary.nextActionable[0];

// AI Context provides detailed item context
const context = await spectree__get_ai_context({ 
  id: nextItem.id, 
  type: nextItem.type 
});
```

---

## Best Practices

1. **Call at Session Start** - Always get progress summary when beginning work on an epic

2. **Address Blockers First** - Review `blockedItems` before starting new work

3. **Follow Previous Session** - Check `lastSession.nextSteps` for continuity

4. **Use with Execution Plan** - Combine with execution plan for optimal work ordering

5. **Check Personal Dashboard** - Use `get_my_work` for cross-epic visibility
