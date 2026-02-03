# Deep Analysis: SpecTree AI Framework Compliance

> **Context**: Analysis performed within GitHub Copilot CLI using Claude Opus model  
> **Date**: February 2026

## Executive Summary

After analyzing the SpecTree framework, instruction files, MCP tools, and documentation, I've identified **fundamental structural challenges** that prevent consistent 100% compliance by AI agents (including Opus in Copilot CLI).

---

## The Core Problem: Competing Instructions & Cognitive Overload

### 1. **Instruction Source Fragmentation**

The framework provides instructions through **7+ different sources**:

| Source | Lines | When Loaded |
|--------|-------|-------------|
| `.github/copilot-instructions.md` | 660 | Auto-loaded by Copilot CLI |
| `CLAUDE.md` | 384 | **ALSO** auto-loaded by Copilot CLI |
| `spectree__get_instructions` tool | ~800 | Agent must call it |
| MCP tool descriptions | ~200 | When tools listed |
| `docs/MCP/*.md` files | ~2000+ | Agent must read |
| `ai-native-epic-workflow-guide.md` | 387 | Agent must read |

**Critical Finding**: Copilot CLI loads **BOTH** `CLAUDE.md` AND `.github/copilot-instructions.md` into the system prompt as separate `<custom_instruction>` blocks. This means:

1. **1,044 lines of instructions** before the agent even starts (not 350 as initially thought)
2. **Overlapping but inconsistent content** - the files have similar rules but different wording/detail levels
3. **Sync risk** - updating one file but not the other creates contradictions
4. **Double cognitive load** - agent processes similar instructions twice

**Problem**: There's no guarantee the agent reads all sources before acting. Even if it does, the sheer volume (~100KB+ of instructions) exceeds practical context management.

### 2. **Instruction Density Problem**

The two instruction files combined contain **1,044 lines of dense instructions** with:
- 12+ "🔴 MANDATORY" sections (some duplicated across files)
- Deeply nested multi-step workflows
- Conditional branching ("if X, then Y, else Z")
- Cross-references to other documents
- Code examples that add length but may not improve compliance

**LLM Behavior Reality**: Models optimize for the *most salient* recent instructions. Detailed procedural requirements buried deep in documentation have significantly lower compliance rates than prominent, simple rules.

---

## Why 100% Compliance Is Structurally Impossible

### A. **No Enforcement Mechanism**

The framework relies entirely on **honor-system compliance**. The MCP tools don't enforce:

```
❌ Can call spectree__create_feature WITHOUT executionOrder
❌ Can call spectree__complete_work WITHOUT running validations first
❌ Can skip spectree__start_session entirely
❌ Can ignore spectree__set_structured_description completely
```

**Root Cause**: The API accepts incomplete data without validation failures.

### B. **Tool Call Cost vs. Instructions**

| Action | Tool Calls Required |
|--------|---------------------|
| Create epic properly | 15-30+ calls (template, features, tasks, descriptions, metadata) |
| Create epic minimally | 3-5 calls |

Models naturally minimize tool calls when not under specific constraint pressure. The "proper" workflow is 5x more expensive.

### C. **Context Window Thrashing**

A complete SpecTree workflow involves:
1. Read CLAUDE.md (in system prompt)
2. Read custom instructions (in system prompt)  
3. Call `spectree__get_instructions` (returns 32KB)
4. Call `spectree__list_teams` before epic creation
5. Call `spectree__list_templates` before creation
6. For each feature: `create_feature`, `set_structured_description`
7. For each task: `create_task`, `set_structured_description`
8. Call `spectree__get_execution_plan` to verify

**By step 4-5, the initial instructions have scrolled far out of the model's attention window**.

### D. **Ambiguous Trigger Conditions**

The instructions say to use SpecTree when user asks to "build, implement, create, or develop". But:

- "Fix this bug" - SpecTree? Maybe? 
- "Add a unit test" - SpecTree? Probably not?
- "Refactor this code" - SpecTree? The instructions aren't clear.

The "When NOT to Use SpecTree" section lists exceptions but doesn't define clear thresholds.

---

## Specific Compliance Failures I'd Expect

Based on the framework structure, these failures are **predictable**:

| Requirement | Expected Compliance | Why |
|-------------|---------------------|-----|
| Use templates for epic creation | 40-60% | Agent may skip to `create_epic` directly |
| Call `list_teams` before creating epic | 50-70% | Works if team name "seems obvious" |
| Set structured descriptions on ALL items | 20-40% | Tedious repetition, easy to skip |
| Minimum 3 tasks per feature | 30-50% | Not enforced by API |
| Call `start_session` at session start | 60-80% | One of the more prominent instructions |
| Call `end_session` at session end | 40-60% | Session often ends abruptly |
| Log decisions with rationale | 20-40% | Easy to forget in flow |
| Link code files during implementation | 30-50% | Adds friction to main work |

---

## Recommended Improvements

### Tier 1: High Impact, Low Effort

#### 1. **Consolidate Instruction Files**

**Immediate action**: Copilot CLI loads both `CLAUDE.md` and `.github/copilot-instructions.md`. Choose ONE:

| Option | Recommendation |
|--------|----------------|
| Keep `.github/copilot-instructions.md` only | ✅ **Recommended** - standard Copilot location |
| Keep `CLAUDE.md` only | Works but non-standard |
| Symlink one to the other | Avoids duplication but confusing |

**Implementation**:
```bash
# Option A: Delete CLAUDE.md (after merging any unique content)
rm CLAUDE.md

# Option B: Make CLAUDE.md redirect
echo "See .github/copilot-instructions.md" > CLAUDE.md
```

This immediately cuts instruction volume by ~40% and eliminates sync issues.

#### 2. **API-Level Validation Gates**

Make the API reject incomplete requests:

```typescript
// In feature creation validation
if (isCreatingViaMCP && !executionOrder) {
  throw new ValidationError("executionOrder required when creating via MCP");
}

if (isCreatingViaMCP && !description?.includes("## Acceptance Criteria")) {
  throw new ValidationError("Structured description with acceptance criteria required");
}
```

**This moves compliance from "agent should" to "agent must".**

#### 3. **Simplified Instruction Hierarchy**

Replace 1,044 lines across two files with a single checklist at the top of `.github/copilot-instructions.md`:

```markdown
## SpecTree Quick Reference (ALWAYS READ FIRST)

Before ANY implementation task:
□ spectree__list_teams() - verify team exists
□ spectree__start_session({ epicId }) - if continuing work
□ spectree__list_templates() - use template for new epics

After creating epic:
□ Every feature has executionOrder + estimatedComplexity
□ Every feature has 3+ tasks
□ Every feature/task has set_structured_description called

Before completing work:
□ spectree__run_all_validations()
□ spectree__link_code_file() for modified files
□ spectree__log_decision() for any choices made

At session end:
□ spectree__end_session() with summary + nextSteps
```

#### 4. **Composite MCP Tools**

Create single tools that enforce multi-step workflows:

```typescript
spectree__create_epic_complete({
  name: "My Epic",
  team: "Engineering", 
  features: [
    {
      title: "Feature 1",
      executionOrder: 1,
      estimatedComplexity: "moderate",
      tasks: [...],  // With full details
      structuredDescription: {...}  // Required
    }
  ]
})
```

One call that creates everything with validation, rather than 15+ sequential calls.

### Tier 2: Medium Impact, Medium Effort

#### 5. **Session State Machine**

Add session state tracking that blocks certain operations:

```
Session States: NONE → STARTED → WORKING → COMPLETING → ENDED

- Can't call start_work without session in STARTED state
- Can't call complete_work without running validations
- Warn if session ends without end_session
```

#### 6. **Progress Checkpoint Reminders**

Have `spectree__log_progress` automatically called every N tool calls:

```
After 10 tool calls since last progress log:
"⚠️ Consider calling spectree__log_progress to checkpoint your work"
```

#### 7. **Instruction Embedding in Tool Responses**

Include relevant instructions in tool responses:

```json
{
  "data": { "featureId": "COM-123" },
  "reminder": "Next required steps: 1) Call set_structured_description, 2) Create at least 3 tasks"
}
```

### Tier 3: Structural Changes

#### 8. **Replace Documentation with Guided Workflow**

Instead of documentation the agent must read, create a **guided workflow tool**:

```typescript
spectree__get_next_required_action({ context: "creating_epic" })
// Returns: "Call spectree__list_templates() - templates must be used for epic creation"

spectree__get_next_required_action({ context: "feature_created", featureId: "COM-123" })  
// Returns: "Call spectree__set_structured_description({ id: 'COM-123', ... }) - all features need structured descriptions"
```

The agent asks "what should I do next" and gets specific instruction.

#### 9. **Instruction File Restructuring**

Current structure (problematic):
```
# File 1: CLAUDE.md (384 lines)
## Section 1
Condensed rules...

# File 2: .github/copilot-instructions.md (660 lines)  
## Section 1
Same rules with more detail and code examples...

# Result: Agent sees BOTH, gets confused by subtle differences
```

Better structure (single file):
```
# .github/copilot-instructions.md

## RULES (Read before every response) - 20 lines max
1. [Rule in one line]
2. [Rule in one line]
...

## REFERENCE (Read as needed)
[Detailed explanations, code examples]
```

---

## Honest Assessment: Is 100% Compliance Achievable?

**Short answer: No, not with current LLM + MCP architecture.**

**Longer answer**: 

Current LLM architectures are **statistically-driven text predictors**, not rule-following engines. They:
- Don't have persistent state across calls
- Can't guarantee procedural compliance
- Optimize for "reasonable" outputs, not "correct" processes
- Degrade gracefully rather than fail hard

To get closer to 100% compliance:

1. **Consolidate instruction files** (immediate): Eliminate CLAUDE.md duplication
2. **Move validation to server** (70% → 90%): API rejects incomplete work
3. **Simplify rules** (90% → 95%): Fewer, clearer instructions  
4. **Guided workflow** (95% → 98%): Tool tells agent what to do next
5. **Composite tools** (98% → 99%): Single calls that do multi-step workflows

**True 100% requires**: A deterministic orchestration layer (not an LLM) that invokes the LLM only for creative work, while a rules engine handles compliance.

---

## Conclusion

The SpecTree framework is **well-designed for human users** who can read documentation and follow procedures. But AI agents aren't humans - they're probabilistic systems that require:

1. **Single source of truth** (one instruction file, not two)
2. **Enforcement over guidance** (validation gates)
3. **Simplicity over completeness** (short checklists, not long docs)
4. **Reminders over instructions** (tool responses include next steps)
5. **Composite operations over sequences** (one tool, one workflow)

The current framework tries to make AI agents "follow the rules" through detailed instructions duplicated across multiple files. A more effective approach is to:

1. **Immediately**: Remove `CLAUDE.md` or consolidate into `.github/copilot-instructions.md`
2. **Short-term**: Make following the rules the **only possible path** through API validation
3. **Long-term**: Build guided workflow tools that tell agents what to do next
