# Dispatcher Documentation Archive

> **Purpose:** This directory contains historical planning documents, strategy analyses, and proposals that have been completed or superseded.

---

## 📁 Directory Structure

```
archive/
├── planning/       # Pre-implementation planning documents and completed work
└── analysis/       # Technical analysis and decision-making documents
```

---

## 📋 What's Archived Here

### Why Archive?

Documents are archived when they:
1. **Describe work that has been completed** - Implementation is done, but the document provides historical context
2. **Are pre-implementation planning** - Strategy and analysis that guided implementation
3. **Have been superseded** - Replaced by current documentation or implementation
4. **Provide historical value** - Worth keeping for understanding past decisions

### What's NOT Archived

- **Current implementation references** - These stay in the main `docs/` directory
- **Ongoing guides** - Active how-tos, setup guides, and API docs
- **Living documentation** - Docs that are regularly updated

---

## 🗂️ Planning Documents

Located in [planning/](./planning/)

These documents guided feature implementation and have been marked as completed:

| Document | Status | Completion Date | Notes |
|----------|--------|----------------|-------|
| [platform-improvements-plan-COMPLETED.md](./planning/platform-improvements-plan-COMPLETED.md) | ✅ Completed | Feb 2025 | All 5 epics implemented: MCP consolidation, SSE updates, test DB isolation, execution plan viz, entity changelog |
| [template-enhancement-instructions-COMPLETED.md](./planning/template-enhancement-instructions-COMPLETED.md) | ✅ Completed | Feb 2025 | Template system enhanced with structured descriptions and complexity estimates |
| [dispatcher-automation-tool-strategy.md](./planning/dispatcher-automation-tool-strategy.md) | 📜 Historical | Feb 2025 | Original 128KB strategy document for automation framework |
| [copilot-cli-automation-strategy.md](./planning/copilot-cli-automation-strategy.md) | 📜 Historical | Feb 2025 | Copilot CLI integration strategy and approach |
| [automation-epic-prompts.md](./planning/automation-epic-prompts.md) | 📜 Historical | Feb 2025 | Templates for automation epic creation |
| [ai-enhancement-proposals.md](./planning/ai-enhancement-proposals.md) | 📜 Historical | Various | Collection of AI enhancement proposals |
| [user-registration-options-analysis.md](./planning/user-registration-options-analysis.md) | 📜 Reference | Jan 2025 | Detailed analysis of user registration approaches (not yet implemented) |
| [ENDPOINT-INVENTORY.md](./planning/ENDPOINT-INVENTORY.md) | 📜 Historical | Feb 2026 | Pre-cleanup inventory of all 164 API endpoints; counts superseded by docs/api/ |
| [AUDIT-REPORT.md](./planning/AUDIT-REPORT.md) | 📜 Historical | Feb 2026 | Pre-cleanup documentation coverage audit (~40%); superseded by expanded API docs |

---

## 🔍 Analysis Documents

Located in [analysis/](./analysis/)

These documents captured technical analysis and decision-making:

| Document | Decision Made | Date | Outcome |
|----------|--------------|------|---------|
| [analysis-dispatcher-mcp-vs-copilot-sdk.md](./analysis/analysis-dispatcher-mcp-vs-copilot-sdk.md) | MCP vs Copilot SDK | Feb 2025 | Chose MCP approach |
| [ai-framework-compliance-analysis.md](./analysis/ai-framework-compliance-analysis.md) | AI instruction compliance | Feb 2025 | Led to instruction consolidation |
| [platform-analysis-for-dispatcher-orchestrator.md](./analysis/platform-analysis-for-dispatcher-orchestrator.md) | Platform choice | Feb 2025 | Chose CLI + Web Dashboard |

---

## 🎯 How Completed Documents Are Marked

### Naming Convention

**Completed planning documents** are renamed with a `-COMPLETED` suffix:
- `platform-improvements-plan.md` → `platform-improvements-plan-COMPLETED.md`
- `template-enhancement-instructions.md` → `template-enhancement-instructions-COMPLETED.md`

This makes it immediately clear that:
1. The work described has been fully implemented
2. The document is retained for historical reference
3. Readers should not treat it as a current action plan

### Status Indicators

| Status | Meaning |
|--------|---------|
| ✅ Completed | Work has been fully implemented |
| 📜 Historical | Pre-implementation planning or strategy |
| 📜 Reference | Still valuable for reference despite being archived |

---

## 📚 Using Archived Documents

### When to Reference Archived Docs

1. **Understanding past decisions** - Why was approach X chosen over Y?
2. **Reviewing implementation history** - What features were planned and delivered?
3. **Learning from strategy** - What analysis went into a major decision?
4. **Onboarding context** - Understanding the evolution of the project

### Where to Find Current Docs

For current documentation, see [docs/README.md](../README.md)

---

## 🔄 Archive Maintenance

### Adding to Archive

When archiving a document:
1. Move to appropriate subdirectory (`planning/` or `analysis/`)
2. Add `-COMPLETED` suffix if work is done
3. Update `docs/README.md` to reflect the move
4. Update this file with entry and status
5. Add git commit explaining why it was archived

### Never Delete

**Historical documents should be archived, not deleted.** They provide valuable context for:
- Future team members understanding project evolution
- Decision audits ("Why did we choose X?")
- Avoiding repeated analysis of the same questions
- Learning from past planning approaches

---

## 📬 Questions?

If you're unsure whether a document should be archived:
- **Is it describing future work?** → Keep in main docs
- **Is it a completed plan?** → Archive with `-COMPLETED` suffix
- **Is it pre-implementation analysis?** → Archive in `analysis/`
- **Is it historical strategy?** → Archive in `planning/`
- **Is it still actively used?** → Keep in main docs

For current documentation, see [docs/README.md](../README.md)
