# Creating Your First Epic

Learn how to create a SpecTree epic from scratch using MCP tools. This guide walks you through planning a simple feature, creating the epic structure, and understanding the core concepts.

**Time Estimate:** ~10 minutes

---

## Prerequisites

- SpecTree installed and running locally
- GitHub Copilot configured with SpecTree MCP server
- Basic understanding of project management concepts (epics, features, tasks)

**Verify setup:**
```
@spectree list teams
```

You should see a list of available teams (or "Engineering" if using default setup).

---

## What You'll Build

We'll create an epic for adding a simple user preferences API:

- **Epic:** User Preferences API
- **Features:** 
  - API endpoints (GET/PUT)
  - Database model
  - Frontend settings page
- **Tasks:** Each feature broken into implementation steps

---

## Steps

### Step 1: Choose Your Team

List available teams and select one:

```
@spectree list teams
```

**Expected output:**
```
Teams:
- Engineering (ENG)
- Product (PRD)
- Design (DSN)
```

For this guide, we'll use **Engineering**.

### Step 2: Create the Epic

Use the MCP tool to create a new epic:

```
@spectree create an epic named "User Preferences API" for team Engineering with description "Add REST API endpoints and UI for user preferences like theme, language, and notifications"
```

**What happens:**
- SpecTree creates a new epic record
- Assigns it to the Engineering team
- Generates an identifier (e.g., `ENG-42`)
- Sets status to "Backlog"

**Expected output:**
```
✅ Created epic ENG-42: User Preferences API
   Team: Engineering
   Status: Backlog
   
Next: Add features to the epic
```

### Step 3: Add Your First Feature

Create a feature for the API endpoints:

```
@spectree add feature to epic ENG-42 titled "REST API endpoints for preferences" with description "Implement GET /api/v1/preferences and PUT /api/v1/preferences with Zod validation"
```

**Expected output:**
```
✅ Created feature ENG-42-1: REST API endpoints for preferences
   Parent Epic: ENG-42
   Status: Backlog
```

### Step 4: Add Tasks to the Feature

Break down the feature into actionable tasks:

```
@spectree add task to feature ENG-42-1 titled "Define Prisma schema for UserPreferences model"

@spectree add task to feature ENG-42-1 titled "Create Zod validation schemas for preferences"

@spectree add task to feature ENG-42-1 titled "Implement GET endpoint handler"

@spectree add task to feature ENG-42-1 titled "Implement PUT endpoint handler"

@spectree add task to feature ENG-42-1 titled "Add unit tests for endpoints"
```

**Tip:** Use descriptive task titles that clearly state what needs to be done.

### Step 5: Set Execution Metadata

Add execution order and complexity estimates to guide implementation:

```
@spectree set execution metadata for feature ENG-42-1 with executionOrder 1, complexity moderate, can parallelize false
```

**Why this matters:**
- `executionOrder: 1` — Do this feature first
- `complexity: moderate` — Estimated 1-3 days
- `canParallelize: false` — Don't run alongside other features

### Step 6: Add Structured Descriptions

Provide detailed AI instructions for each task:

```
@spectree set structured description for task ENG-42-1-1 with summary "Define Prisma schema for UserPreferences model" and aiInstructions "Add a new UserPreferences model to packages/api/prisma/schema.prisma with fields: userId (unique), theme (string), language (string), emailNotifications (boolean), pushNotifications (boolean). Run npx prisma db push after adding the model."
```

Repeat for other tasks with appropriate instructions.

### Step 7: Review in the UI

Open SpecTree web UI to verify your epic:

1. Navigate to http://localhost:5173/epics
2. Find your epic (e.g., ENG-42)
3. Click to view details
4. Verify features and tasks are structured correctly

### Step 8: Add Acceptance Criteria

Define how you'll know the work is complete:

```
@spectree add acceptance criterion to feature ENG-42-1 "GET endpoint returns user preferences with 200 status"

@spectree add acceptance criterion to feature ENG-42-1 "PUT endpoint updates preferences and returns 200 status"

@spectree add acceptance criterion to feature ENG-42-1 "Invalid requests return 400 with error details"

@spectree add acceptance criterion to feature ENG-42-1 "All endpoints have unit test coverage"
```

---

## Expected Output

After completing all steps, you should have:

✅ An epic (ENG-42) with 1 feature  
✅ Feature (ENG-42-1) with 5 tasks  
✅ Execution metadata set (order, complexity)  
✅ Structured descriptions with AI instructions  
✅ Acceptance criteria for validation  

**Verify:**
```
@spectree get epic ENG-42
```

---

## Common Pitfalls

### "Team not found"

**Problem:** Specified team doesn't exist  
**Solution:** Run `@spectree list teams` to see available teams, or create a new team in the UI

### "Feature created but no tasks visible"

**Problem:** Tasks were created but not appearing  
**Solution:** Refresh the UI or run `@spectree get feature ENG-42-1` to verify tasks exist

### "Cannot set execution metadata"

**Problem:** Feature/task ID is incorrect  
**Solution:** Double-check the identifier (e.g., `ENG-42-1` not `ENG-42 -1`)

### "Structured description not saving"

**Problem:** MCP tool might have timed out  
**Solution:** Retry the command, check MCP logs for errors

---

## Next Steps

Now that you have an epic structure:

- **[Set Up Validation Checks](./validation-checks.md)** — Add automated acceptance tests
- **[Use the Planner Agent](./planner-agent.md)** — Let AI decompose requirements for you
- **[Run Orchestrated Implementation](./orchestration.md)** — Execute with parallel agents

---

## What You Learned

✅ How to create epics, features, and tasks via MCP  
✅ Setting execution metadata for planning  
✅ Adding structured descriptions for AI implementation  
✅ Defining acceptance criteria for validation  

**Pro Tip:** Use templates to speed this up! See `@spectree list templates` for pre-built epic structures.
