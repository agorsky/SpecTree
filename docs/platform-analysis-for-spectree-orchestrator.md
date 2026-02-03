# Platform Analysis: SpecTree Parallel Agent Orchestrator

## Executive Summary

**Recommended Approach: CLI Tool + Web Dashboard (Hybrid)**

For a team tool that orchestrates parallel AI agents with SpecTree, I recommend a **CLI-first approach with an optional web dashboard** built on top of your existing SpecTree infrastructure.

---

## Platform Options Analyzed

### Option 1: CLI Tool (npm package)
**`npx @spectree/agent run "Build user dashboard"`**

| Pros | Cons |
|------|------|
| ✅ Simplest to build and maintain | ❌ No visual progress monitoring |
| ✅ Works in any terminal/IDE | ❌ Requires CLI comfort |
| ✅ Easy npm distribution | ❌ No collaboration visibility |
| ✅ Integrates with existing workflows | |
| ✅ Low infrastructure cost ($0) | |

**Complexity: Low** | **Team Adoption: Medium**

---

### Option 2: VS Code Extension

| Pros | Cons |
|------|------|
| ✅ Integrated in developer's IDE | ❌ Locks to VS Code users |
| ✅ Rich UI possibilities | ❌ Extension development is complex |
| ✅ Can show real-time progress | ❌ Harder to maintain (VS Code API changes) |
| ✅ Natural for developers | ❌ Can't easily view team-wide progress |

**Complexity: High** | **Team Adoption: High (for VS Code users)**

---

### Option 3: Web Application (Dashboard)

| Pros | Cons |
|------|------|
| ✅ Team visibility into all work | ❌ Requires hosting infrastructure |
| ✅ Real-time progress dashboard | ❌ More complex to build |
| ✅ Works from anywhere | ❌ Separate from coding environment |
| ✅ Non-technical stakeholders can view | ❌ Ongoing maintenance |
| ✅ You already have SpecTree web! | |

**Complexity: Medium** | **Team Adoption: High**

---

### Option 4: Slack/Teams Bot

| Pros | Cons |
|------|------|
| ✅ Conversational interface | ❌ Limited for complex interactions |
| ✅ Team notifications built-in | ❌ Bot development complexity |
| ✅ Mobile-friendly | ❌ Not ideal for code-heavy work |

**Complexity: Medium** | **Team Adoption: Medium**

---

### Option 5: GitHub Action

| Pros | Cons |
|------|------|
| ✅ CI/CD integration | ❌ Not interactive |
| ✅ Runs in GitHub's infrastructure | ❌ Slow feedback loop |
| ✅ Audit trail in Actions logs | ❌ Can't intervene mid-run |

**Complexity: Low** | **Team Adoption: Low (for interactive work)**

---

## 🏆 Recommended Architecture: CLI + Web Dashboard Hybrid

Given that you already have SpecTree (web app + API), the smartest path is:

```
┌─────────────────────────────────────────────────────────────────┐
│                    SpecTree Ecosystem                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐   │
│   │   CLI Tool   │     │  Web Dashboard│     │  SpecTree    │   │
│   │  (new pkg)   │     │  (extend web) │     │  API         │   │
│   │              │     │               │     │  (existing)  │   │
│   │ • Run epics  │     │ • View runs   │     │              │   │
│   │ • Monitor    │     │ • Team status │     │ • Epics      │   │
│   │ • Intervene  │     │ • Logs/history│     │ • Features   │   │
│   └──────┬───────┘     └───────┬───────┘     │ • Tasks      │   │
│          │                     │             │ • Sessions   │   │
│          └─────────────────────┴─────────────┤ • Progress   │   │
│                         ▼                    └──────────────┘   │
│              ┌──────────────────┐                    ▲          │
│              │ Orchestrator     │                    │          │
│              │ Service          │────────────────────┘          │
│              │                  │     REST API calls            │
│              │ • Parallel agents│                               │
│              │ • Phase execution│                               │
│              │ • Branch mgmt    │                               │
│              └──────────────────┘                               │
│                       │                                         │
│                       ▼                                         │
│              ┌──────────────────┐                               │
│              │ Copilot SDK      │                               │
│              │ (multiple        │                               │
│              │  sessions)       │                               │
│              └──────────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: CLI Tool (2-3 weeks)
**Goal:** Working parallel agent orchestration from command line

```
packages/
├── api/          # existing
├── web/          # existing  
├── mcp/          # existing
├── shared/       # existing
└── orchestrator/ # NEW
    ├── src/
    │   ├── cli.ts           # CLI entry point
    │   ├── orchestrator.ts  # Core orchestration logic
    │   ├── agent-pool.ts    # Manage parallel SDK sessions
    │   ├── branch-manager.ts# Git branch coordination
    │   └── progress.ts      # Real-time CLI output
    └── package.json
```

**Usage:**
```bash
# Install globally or use npx
npm install -g @spectree/orchestrator

# Run an epic with parallel agents
spectree-agent run "Build user activity dashboard" --team Engineering

# Continue existing epic
spectree-agent continue "Activity Dashboard"

# Monitor running agents
spectree-agent status

# Intervene in a specific agent
spectree-agent pause worker-2
spectree-agent resume worker-2
```

**Why CLI First:**
- Fastest to build (no UI)
- Developers already live in terminal
- Easy to distribute via npm
- Can be called from VS Code terminal
- Foundation for other platforms

---

### Phase 2: Web Dashboard Integration (2-3 weeks)
**Goal:** Team visibility and management through existing SpecTree web

**Add to existing `packages/web/`:**
```typescript
// New pages/components
src/
├── pages/
│   └── orchestrator/
│       ├── runs.tsx        # List of orchestration runs
│       ├── run-detail.tsx  # Single run with agent progress
│       └── agents.tsx      # Active agents view
├── components/
│   └── orchestrator/
│       ├── AgentCard.tsx   # Individual agent status
│       ├── PhaseTimeline.tsx
│       └── LiveLog.tsx     # Real-time log streaming
```

**Features:**
- View all active orchestration runs
- Real-time progress per agent (WebSocket)
- Phase visualization (timeline view)
- Intervention controls (pause/resume/cancel)
- Run history and logs
- Team activity feed

---

### Phase 3: Enhanced Features (Optional, ongoing)

| Feature | Effort | Value |
|---------|--------|-------|
| VS Code extension (thin client to CLI) | Medium | High for VS Code teams |
| Slack notifications | Low | Medium |
| GitHub Action for CI/CD | Low | Medium |
| Mobile-responsive dashboard | Low | Low |

---

## Technical Stack Recommendation

### CLI Tool (`packages/orchestrator`)

```json
{
  "name": "@spectree/orchestrator",
  "dependencies": {
    "@github/copilot-sdk": "latest",
    "commander": "^11.0.0",      // CLI framework
    "ora": "^7.0.0",             // Spinners
    "chalk": "^5.0.0",           // Colors
    "ink": "^4.0.0",             // React for CLI (optional, for rich UI)
    "simple-git": "^3.0.0",      // Git operations
    "ws": "^8.0.0"               // WebSocket for live updates
  }
}
```

### Why This Stack:
- **Commander** - Industry standard CLI framework
- **Ink** (optional) - If you want rich terminal UI like progress bars
- **simple-git** - Clean API for branch management
- **Copilot SDK** - The core engine

---

## Comparison: Build vs Buy

| Aspect | Build (This Approach) | Buy/Use Existing |
|--------|----------------------|------------------|
| **Control** | Full control over workflow | Limited to tool's design |
| **Integration** | Tight SpecTree integration | May need adapters |
| **Cost** | Dev time + Copilot licenses | Tool licenses + Copilot |
| **Maintenance** | You maintain it | Vendor maintains |
| **Customization** | Unlimited | Limited |

**Alternatives to building:**
- **Copilot Swarm Orchestrator** (open source) - Generic parallel runner
- **Mission Control** (GitHub native) - Browser-based, less customizable
- **n8n / Temporal** - Workflow engines (overkill for this)

**Verdict:** Build it. You have SpecTree's execution planning already - you just need the runner.

---

## Team Onboarding Experience

### For Developers:

```bash
# One-time setup
npm install -g @spectree/orchestrator
spectree-agent auth  # Links to SpecTree API token

# Daily use
cd my-project
spectree-agent run "Add user authentication with OAuth"
# → Creates epic, spawns agents, shows real-time progress
# → Opens PR when done
```

### For Team Leads (via Web Dashboard):

1. Open SpecTree web → Orchestrator tab
2. See all active runs across team
3. Click into any run to see agent progress
4. View decisions made, blockers encountered
5. Intervene if needed

---

## Cost Analysis

| Component | Cost |
|-----------|------|
| Copilot SDK | Included with Copilot subscription |
| SpecTree hosting | Already have |
| CLI distribution | Free (npm) |
| Additional infra | None (runs locally) |

**Total additional cost: $0** (beyond existing Copilot licenses)

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Copilot SDK is in "Technical Preview" | Start simple, don't over-invest in SDK-specific patterns |
| Parallel agents may conflict | Use branch-per-agent strategy; your execution plan already defines safe parallelism |
| Team adoption friction | CLI-first is low friction; web dashboard adds visibility |
| Maintenance burden | Leverage existing SpecTree API; orchestrator is thin layer |

---

## Recommended Next Steps

1. **Create `packages/orchestrator`** with basic CLI structure
2. **Implement single-agent runner** first (prove SDK integration works)
3. **Add parallel execution** using your execution plan phases
4. **Add real-time CLI progress** (spinners, logs)
5. **Integrate with SpecTree API** for session tracking
6. **Build web dashboard** for team visibility
7. **Document and distribute** to team

---

## Summary

| Recommendation | Rationale |
|----------------|-----------|
| **Platform:** CLI + Web Dashboard | Lowest friction, reuses your existing SpecTree |
| **Distribution:** npm package | Easy install, familiar to developers |
| **Architecture:** Thin orchestrator on SDK | SpecTree API does heavy lifting |
| **Team visibility:** Extend SpecTree web | Don't build separate dashboard |
| **Timeline:** 4-6 weeks for v1 | CLI (2-3w) + Web (2-3w) |

The CLI gives you immediate power; the web dashboard gives your team visibility. Both build on what you already have.
