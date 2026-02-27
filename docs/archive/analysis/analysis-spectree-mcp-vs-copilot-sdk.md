# Analysis: Dispatcher MCP Framework vs GitHub Copilot SDK

## What You've Built with Dispatcher MCP

Your Dispatcher MCP framework is a sophisticated **tool-based approach** to controlling AI agent behavior. Here's what it does:

### Current Architecture

```
┌──────────────────┐     Tool Calls     ┌──────────────────┐
│   Copilot CLI    │ ←────────────────→ │   Dispatcher MCP   │
│   (AI Agent)     │   JSON-RPC/stdio   │   Server         │
└──────────────────┘                    └──────────────────┘
        ↓                                       ↓
   Uses custom                            HTTP API calls
   instructions                                 ↓
   (.github/copilot-                    ┌──────────────────┐
   instructions.md)                     │   Dispatcher API   │
                                        │   (REST/Prisma)  │
                                        └──────────────────┘
```

### What Dispatcher MCP Provides (60+ tools)

1. **Project Management** - Epics, Features, Tasks CRUD
2. **Session Management** - `start_session`, `end_session`, handoff context
3. **Progress Tracking** - `log_progress`, `complete_work`, `get_progress_summary`
4. **Execution Planning** - `get_execution_plan`, dependencies, parallel groups
5. **AI Context** - `set_ai_context`, `append_ai_note` for cross-session memory
6. **Code Context** - `link_code_file`, `link_branch`, `link_commit`
7. **Decision Logging** - `log_decision` for audit trail
8. **Validation Checks** - `add_validation`, `run_all_validations`
9. **Structured Descriptions** - Rich metadata for features/tasks
10. **Templates** - Pre-built epic structures

### What You're Trying to Achieve

Based on the docs, you want **agentic workflow control**:
- AI automatically creates structured plans
- AI follows execution order and dependencies
- AI tracks its own progress across sessions
- AI logs decisions and context
- AI validates work before completing
- **"Minimal prompting, maximum automation"**

---

## What the GitHub Copilot SDK Offers

The Copilot SDK is a **programmatic interface** to run Copilot's agentic engine in your own application.

### Architecture

```
Your Application
       ↓
  SDK Client (TypeScript/Python/Go/.NET)
       ↓ JSON-RPC
  Copilot CLI (server mode)
       ↓
  LLM + Built-in Tools
```

### Key Capabilities

1. **Full Agent Control**
   ```typescript
   const client = new CopilotClient();
   const session = await client.createSession({
     model: "gpt-4.1",
     streaming: true,
     tools: [myCustomTool],
     systemMessage: { content: "You are..." }
   });
   ```

2. **Custom Agents**
   ```typescript
   customAgents: [{
     name: "dispatcher-worker",
     displayName: "Dispatcher Worker",
     description: "Works on Dispatcher features",
     prompt: "You follow the Dispatcher workflow..."
   }]
   ```

3. **Custom Tools** (like MCP, but directly in your app)
   ```typescript
   const myTool = defineTool("do_something", {
     description: "...",
     parameters: { type: "object", properties: {...} },
     handler: async (args) => { /* your code */ }
   });
   ```

4. **MCP Server Integration**
   ```typescript
   mcpServers: {
     dispatcher: {
       type: "stdio",
       command: "node",
       args: ["/path/to/dispatcher-mcp/dist/index.js"],
       env: { API_TOKEN: "..." }
     }
   }
   ```

5. **Event Streaming**
   ```typescript
   session.on("assistant.message_delta", (event) => {
     // Real-time response chunks
   });
   ```

---

## How the SDK Could Give You "Full Control"

### The Problem with Current Approach

Currently, you rely on:
1. **Custom Instructions** (`.github/copilot-instructions.md`) - Guidance that Copilot *should* follow
2. **MCP Tools** - Operations Copilot *can* use
3. **Hope** - That Copilot will actually follow the workflow

**But you have no programmatic control over:**
- Whether Copilot actually calls `start_session` at session start
- Whether it creates features with required metadata
- Whether it ends sessions properly
- The order of operations

### What SDK Could Enable

With the Copilot SDK, you could build a **Dispatcher Agent Orchestrator**:

```typescript
// dispatcher-orchestrator.ts
import { CopilotClient, defineTool } from "@github/copilot-sdk";

// Create controlled session
const client = new CopilotClient();
const session = await client.createSession({
  model: "gpt-4.1",
  tools: dispatcherTools,  // Your MCP tools exposed as SDK tools
  customAgents: [{
    name: "dispatcher-worker",
    prompt: SPECTREE_AGENT_PROMPT,
  }],
});

// FORCED workflow - you control the loop
async function runSpectreeWorkflow(epicId: string, userRequest: string) {
  // 1. FORCE session start (you call it, not the AI)
  const sessionData = await dispatcherApi.startSession(epicId);
  
  // 2. FORCE context loading
  const context = await dispatcherApi.getProgressSummary(epicId);
  
  // 3. INJECT context into AI prompt
  const response = await session.sendAndWait({
    prompt: `
      ## Session Context (from Dispatcher)
      ${JSON.stringify(context)}
      
      ## User Request
      ${userRequest}
      
      ## Instructions
      Based on the context above, work on the next task.
      Use dispatcher tools to track your progress.
    `
  });
  
  // 4. OBSERVE tool calls in real-time
  session.on("tool.call", (event) => {
    console.log("AI is calling:", event.tool, event.args);
    // You could VALIDATE or INTERCEPT here
  });
  
  // 5. FORCE session end (you control when)
  await dispatcherApi.endSession(epicId, extractSummary(response));
}
```

### Key Advantages of SDK Approach

| Aspect | MCP-Only Approach | SDK Orchestrator |
|--------|-------------------|------------------|
| Session Start | AI decides when | You force it |
| Context Loading | AI should do it | You inject it |
| Tool Validation | Hope AI uses correctly | Intercept & validate |
| Session End | AI should remember | You guarantee it |
| Workflow Order | Prompt-guided | Code-enforced |
| Error Handling | AI attempts | You control |
| Multi-step Tasks | AI chains itself | You orchestrate |

---

## Concrete Implementation Options

### Option 1: Minimal - SDK as MCP Client

Use SDK just to ensure sessions are properly started/ended:

```typescript
// Your orchestrator wraps the workflow
async function controlledSession(epicId: string, task: string) {
  await dispatcher.startSession(epicId);  // Guaranteed
  
  try {
    const session = await client.createSession({
      mcpServers: { dispatcher: {...} }
    });
    await session.sendAndWait({ prompt: task });
  } finally {
    await dispatcher.endSession(epicId);  // Guaranteed
  }
}
```

### Option 2: Full Control - Custom Execution Loop

Build a complete orchestration layer:

```typescript
class SpectreeOrchestrator {
  private client: CopilotClient;
  
  async executeEpic(epicId: string) {
    // Get execution plan
    const plan = await dispatcher.getExecutionPlan(epicId);
    
    for (const phase of plan.phases) {
      for (const item of phase.items) {
        // Start work (forced)
        await dispatcher.startWork(item.id, item.type);
        
        // Let AI do the actual coding
        await this.aiSession.sendAndWait({
          prompt: this.buildTaskPrompt(item)
        });
        
        // Run validations (forced)
        const validations = await dispatcher.runAllValidations(item.id);
        
        if (validations.allPassed) {
          await dispatcher.completeWork(item.id);
        } else {
          await dispatcher.reportBlocker(item.id, validations.failures);
        }
      }
    }
  }
}
```

### Option 3: Hybrid - Agent with Guardrails

Let AI work freely but with enforcement:

```typescript
// Custom tool that wraps every AI tool call
const guardedTool = defineTool("dispatcher_action", {
  handler: async (args) => {
    // VALIDATE the action makes sense
    if (args.action === "complete_work" && !await hasPassedValidations(args.id)) {
      return { error: "Cannot complete - validations not passed" };
    }
    
    // LOG everything
    await auditLog.record(args);
    
    // FORWARD to actual Dispatcher
    return await dispatcher[args.action](args);
  }
});
```

---

## Recommendation

The **Copilot SDK could absolutely give you full control** over the workflow you've been trying to achieve with MCP + instructions. Specifically:

### What SDK Adds

1. **Guaranteed Lifecycle** - You programmatically start/end sessions
2. **Context Injection** - You load and inject context, not rely on AI to fetch it
3. **Tool Interception** - Monitor, validate, or modify tool calls
4. **Workflow Orchestration** - Code-driven execution order, not prompt-hoped
5. **Error Recovery** - Catch and handle failures programmatically

### What You'd Build

A **Dispatcher Agent Runner** application that:
1. Exposes your existing MCP tools to the SDK
2. Wraps every session in proper start/end lifecycle
3. Loads context and injects it (rather than hoping AI fetches it)
4. Monitors tool usage in real-time
5. Validates work completion before allowing `complete_work`
6. Provides a clean API or CLI for "Continue working on [epic]"

### Trade-offs

| Consideration | Current (MCP + Instructions) | SDK Orchestrator |
|---------------|------------------------------|------------------|
| Complexity | Lower (just tools + docs) | Higher (new application) |
| Control | Suggestive | Enforced |
| Reliability | AI-dependent | Code-guaranteed |
| Flexibility | AI can deviate | AI is constrained |
| Development | Minimal code | Significant code |

---

## Next Steps If You Want to Pursue SDK

1. **Install SDK**: `npm install @github/copilot-sdk`
2. **Create wrapper**: `packages/orchestrator/` that imports MCP tools
3. **Build session runner**: Start/end lifecycle guarantee
4. **Add context injection**: Load Dispatcher context, inject into prompts
5. **Add monitoring**: Log and validate tool calls
6. **Create CLI/API**: `dispatcher-agent work [epic]`

Would you like me to prototype any of these approaches?
