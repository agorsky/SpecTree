# Dispatcher Workflow Cookbook

Step-by-step guides for common Dispatcher workflows. Each guide includes prerequisites, detailed steps, expected outputs, and troubleshooting tips.

---

## 📚 Available Guides

### Getting Started

- **[Creating Your First Epic](./first-epic.md)** — Create an epic from scratch using the Dispatcher MCP tools *(~10 minutes)*
- **[Using the Planner Agent](./planner-agent.md)** — Decompose requirements into structured epics with AI *(~15 minutes)*

### Development Workflows

- **[Setting Up Validation Checks](./validation-checks.md)** — Define executable acceptance criteria for tasks *(~10 minutes)*
- **[Running Orchestrated Implementation](./orchestration.md)** — Execute epics with parallel AI agents *(~30 minutes)*
- **[Code Review with Reviewer Agent](./reviewer-agent.md)** — Validate implementations automatically *(~15 minutes)*

### Maintenance & Management

- **[Updating Skill Packs](./update-packs.md)** — Keep your packs up-to-date with latest features *(~5 minutes)*
- **[Creating a Custom Skill Pack](./custom-pack.md)** — Build organization-specific agents and skills *(~45 minutes)*

---

## How to Use These Guides

Each guide follows this structure:

1. **Prerequisites** — What you need before starting
2. **Steps** — Numbered instructions with commands and examples
3. **Expected Output** — What success looks like
4. **Common Pitfalls** — Issues to avoid and how to fix them
5. **Time Estimate** — How long the workflow takes

**Tip:** Follow guides in order if you're new to Dispatcher. Start with "Creating Your First Epic" to understand the basics.

---

## Quick Reference

### Essential Commands

```bash
# Skill Pack Management (specify your registry URL or set SPECTREE_REGISTRY_URL)
dispatcher list --registry https://your-dispatcher-instance.com
dispatcher install @dispatcher/full --registry https://your-dispatcher-instance.com
dispatcher update --all --registry https://your-dispatcher-instance.com

# Or set the env var once to avoid repeating --registry:
export SPECTREE_REGISTRY_URL=https://your-dispatcher-instance.com
dispatcher install @dispatcher/full    # Uses SPECTREE_REGISTRY_URL

# Dispatcher MCP Tools (in GitHub Copilot)
@dispatcher list epics               # List your epics
@dispatcher create epic              # Create epic interactively
@dispatcher get progress <epic-id>   # Check epic progress
```

### Common Patterns

**Planning Pattern:**
1. Describe requirement in natural language
2. Run `@planner` to decompose into epic
3. Review and adjust in Dispatcher UI
4. Start implementation

**Implementation Pattern:**
1. Create feature with tasks
2. Add structured descriptions with AI instructions
3. Set execution order and dependencies
4. Use worker agent to implement
5. Validate with acceptance criteria

**Review Pattern:**
1. Complete implementation work
2. Run `@reviewer` agent
3. Review feedback and suggested changes
4. Apply fixes
5. Re-run validation

---

## Need Help?

- **Stuck on a step?** Check the [Troubleshooting Guide](../troubleshooting.md)
- **Concept unclear?** Read the [Architecture Overview](../architecture/skill-packs.md)
- **Want to understand the tools?** See the [MCP Tools Reference](../mcp/tools-reference.md)

---

## Contributing Workflows

Have a useful workflow to share? We welcome contributions!

1. Fork the repository
2. Add your guide to `docs/cookbook/`
3. Follow the standard structure (Prerequisites, Steps, etc.)
4. Link from this README
5. Submit a pull request

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.
