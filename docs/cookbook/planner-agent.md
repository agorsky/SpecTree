# Using the Planner Agent

The planner agent decomposes natural language requirements into structured Dispatcher epics with features, tasks, execution metadata, and AI instructions. This guide shows you how to use it effectively.

**Time Estimate:** ~15 minutes

---

## Prerequisites

- **Planner agent installed:** Run `dispatcher install @dispatcher/planning` or `@dispatcher/full`
- **Dispatcher running:** API at http://localhost:3001
- **GitHub Copilot configured** with Dispatcher MCP server
- **A requirement to plan** — Can be a feature description, user story, or technical spec

**Verify planner is available:**
```
@planner help
```

---

## How the Planner Works

The planner agent:

1. **Analyzes your codebase** — Reads existing files, patterns, conventions
2. **Decomposes the requirement** — Breaks it into features and tasks
3. **Adds execution metadata** — Sets order, dependencies, complexity
4. **Generates AI instructions** — Writes implementation guidance for each task
5. **Creates the epic** — Stores everything in Dispatcher

---

## Steps

### Step 1: Prepare Your Requirement

Write a clear, concise description of what you want to build. Include:

- **What:** The feature or capability
- **Why:** The goal or user need
- **Technical details:** Frameworks, patterns, constraints

**Example requirement:**

> "Add a notification system with in-app notifications and email digests. Users should see a bell icon with unread count. Clicking it shows recent notifications. Email digests are sent daily at 8am. Store notifications in PostgreSQL with Prisma. Use Server-Sent Events (SSE) for real-time updates."

### Step 2: Invoke the Planner

Use the `@planner` agent with your requirement:

```
@planner "Add a notification system with in-app notifications and email digests. Users should see a bell icon with unread count. Clicking it shows recent notifications. Email digests are sent daily at 8am. Store notifications in PostgreSQL with Prisma. Use Server-Sent Events (SSE) for real-time updates."
```

**What happens:**

The planner will:
1. Confirm it understands the requirement
2. Analyze your codebase (may take 30-60 seconds)
3. Propose an epic structure
4. Ask for confirmation before creating

**Expected output:**

```
🔍 Analyzing requirement...

I'll create an epic for the notification system with these features:

1. Database Schema & Models (3 tasks)
   - Define Prisma notification models
   - Create migrations
   - Add seed data for testing

2. Backend API Endpoints (4 tasks)
   - GET /api/v1/notifications (paginated list)
   - POST /api/v1/notifications (create)
   - PATCH /api/v1/notifications/:id/read (mark read)
   - SSE endpoint for real-time updates

3. Email Digest Service (3 tasks)
   - Email template for digest
   - Scheduled job runner (cron)
   - Digest generation logic

4. Frontend Notification UI (4 tasks)
   - Bell icon component with badge
   - Notification dropdown/panel
   - Real-time SSE connection
   - Notification item rendering

Execution order: Database → Backend → Email Service → Frontend
Dependencies: Each feature depends on the previous

Shall I create this epic? (yes/no)
```

### Step 3: Review and Confirm

Review the proposed structure. Check:

- ✅ Features cover all aspects of the requirement
- ✅ Task breakdowns are logical and actionable
- ✅ Execution order makes sense
- ✅ Dependencies are correct

If satisfied, confirm:

```
yes
```

If you want changes, provide feedback:

```
Add a feature for admin notification management (create, send to all users, view metrics)
```

The planner will revise and ask again.

### Step 4: Planner Creates the Epic

Once confirmed, the planner creates everything in Dispatcher:

```
✅ Created epic ENG-43: Notification System
✅ Created feature ENG-43-1: Database Schema & Models (3 tasks)
✅ Created feature ENG-43-2: Backend API Endpoints (4 tasks)
✅ Created feature ENG-43-3: Email Digest Service (3 tasks)
✅ Created feature ENG-43-4: Frontend Notification UI (4 tasks)

Epic ready for review: http://localhost:5173/epics/ENG-43
```

### Step 5: Review in Dispatcher UI

Open the epic in the web UI:

1. Navigate to http://localhost:5173/epics
2. Click on the new epic (e.g., ENG-43)
3. Expand features to see tasks
4. Review structured descriptions and AI instructions

### Step 6: Refine (Optional)

You can manually adjust:

- **Task descriptions** — Make them more specific to your codebase
- **Acceptance criteria** — Add or modify validation checks
- **Execution order** — Reorder features if needed
- **Complexity estimates** — Adjust based on team velocity

**Using MCP tools:**

```
@dispatcher update task ENG-43-1-1 with description "More detailed task description here"
```

**Using UI:**

Click any item to edit inline.

### Step 7: Ready for Implementation

Your epic is now ready! Next steps:

- **Add validation checks:** See [Setting Up Validation Checks](./validation-checks.md)
- **Run orchestrated execution:** See [Running Orchestrated Implementation](./orchestration.md)
- **Manual implementation:** Work through tasks one by one

---

## Advanced: Planner Options

### Specify a Team

```
@planner "Build a user dashboard" --team Engineering
```

### Request a Specific Structure

```
@planner "Add search filters" --features 2 --tasks-per-feature 3
```

### Use a Template

```
@planner "Create REST API for products" --template api-endpoint
```

### Include Context

Provide additional context by referencing files:

```
@planner "Enhance the authentication flow to support OAuth. Reference the current implementation in packages/api/src/routes/auth.ts"
```

---

## Common Pitfalls

### Planner Creates Too Many Tasks

**Problem:** Task breakdown is overly granular  
**Solution:** Ask the planner to "combine smaller tasks" or manually merge tasks in the UI

### Missing Technical Details

**Problem:** Planner doesn't include framework-specific code  
**Solution:** Provide more context: "Use Fastify for routes, Zod for validation, Prisma for database"

### Wrong Execution Order

**Problem:** Dependencies are incorrect  
**Solution:** Manually adjust via `@dispatcher set execution metadata` or in the UI

### Planner Doesn't Understand Requirement

**Problem:** Vague or ambiguous description  
**Solution:** Be specific about technologies, constraints, and goals. Include examples if helpful.

---

## Tips for Better Planning

1. **Be specific** — Mention frameworks, libraries, patterns you want to use
2. **Include constraints** — "Must support PostgreSQL", "No external dependencies"
3. **Reference existing code** — "Follow the pattern in packages/api/src/routes/users.ts"
4. **State acceptance criteria** — "Users should be able to...", "System must..."
5. **Provide examples** — "Similar to how GitHub handles notifications"

---

## Expected Output

After successful planning:

✅ Epic created with 3-5 features  
✅ Each feature has 2-5 tasks  
✅ Execution metadata set (order, dependencies, complexity)  
✅ Structured descriptions with AI instructions  
✅ Acceptance criteria for each feature  

**Time saved:** 30-60 minutes vs. manual epic creation

---

## Next Steps

- **[Set Up Validation Checks](./validation-checks.md)** — Add automated tests to acceptance criteria
- **[Run Orchestrated Implementation](./orchestration.md)** — Execute the epic with AI agents
- **[Review with Reviewer Agent](./reviewer-agent.md)** — Validate the plan before implementation

---

## What You Learned

✅ How to invoke the planner agent with requirements  
✅ Reviewing and confirming epic structures  
✅ Refining plans in Dispatcher UI  
✅ Best practices for writing clear requirements  

**Pro Tip:** The planner learns from your codebase. The more consistent your code patterns, the better its suggestions.
