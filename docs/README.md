# SpecTree Documentation Index

> **Last Updated:** February 10, 2026  
> **Purpose:** Central index for all SpecTree documentation

---

## 📖 Quick Navigation

- [Getting Started](#getting-started)
- [Architecture & Design](#architecture--design)
- [Developer Guides](#developer-guides)
- [MCP Server](#mcp-server)
- [Orchestrator](#orchestrator)
- [Deployment](#deployment)
- [API Documentation](#api-documentation)
- [Git Workflow](#git-workflow)
- [Historical Documents](#historical-documents)

---

## 🚀 Getting Started

| Document | Description | For |
|----------|-------------|-----|
| [SETUP_GUIDE.md](./SETUP_GUIDE.md) | Complete setup instructions for local development | New developers |
| [automation-quickstart.md](./automation-quickstart.md) | Quick start guide for using SpecTree automation | AI/automation users |
| [mcp-auth-fix-summary.md](./mcp-auth-fix-summary.md) | Troubleshooting MCP authentication issues | Developers |

---

## 🏗️ Architecture & Design

### Core Architecture

| Document | Description | Status |
|----------|-------------|--------|
| [spectree-user-team-epic-model.md](./spectree-user-team-epic-model.md) | Data model: Users, Teams, Epics, Features, Tasks | Current |
| [identity-collaboration-vnext-implementation-reference.md](./identity-collaboration-vnext-implementation-reference.md) | Personal scopes, invite-only teams, access control | Implemented ✅ |
| [user-invitation-system.md](./user-invitation-system.md) | User invitation and registration system | Current |

### Orchestrator Architecture

| Document | Description | Status |
|----------|-------------|--------|
| [orchestrator-architecture.md](./orchestrator-architecture.md) | High-level architecture of the parallel orchestrator | Current |
| [orchestrator-implementation-briefing.md](./orchestrator-implementation-briefing.md) | Detailed implementation guide | Current |
| [orchestrator-parallelism.md](./orchestrator-parallelism.md) | Parallel execution strategy and patterns | Current |

---

## 👨‍💻 Developer Guides

### Database

| Document | Description |
|----------|-------------|
| [database-safety-guide.md](./database-safety-guide.md) | Critical safety practices for database operations |
| [database-multi-provider.md](./database-multi-provider.md) | Multi-provider database strategy (SQLite/PostgreSQL) |
| [secrets-provider.md](./secrets-provider.md) | Azure Key Vault secrets management |
| [secure-database-connection-evaluation.md](./secure-database-connection-evaluation.md) | Database connection security evaluation |

### Testing

| Document | Description |
|----------|-------------|
| [manual-test-sse.md](./manual-test-sse.md) | Manual testing procedures for Server-Sent Events (SSE) |

---

## 🤖 MCP Server

SpecTree provides a Model Context Protocol (MCP) server that exposes 60+ tools for AI agents.

| Document | Description |
|----------|-------------|
| [MCP/IMPLEMENTATION-REFERENCE.md](./MCP/IMPLEMENTATION-REFERENCE.md) | Complete MCP implementation reference |
| [MCP/tools-reference.md](./MCP/tools-reference.md) | Tool reference with categories and descriptions |
| [MCP/api-token-authentication.md](./MCP/api-token-authentication.md) | API token authentication for MCP |
| [MCP/security-architecture.md](./MCP/security-architecture.md) | Security architecture and best practices |

### MCP Features

| Document | Feature |
|----------|---------|
| [MCP/ai-native-epic-workflow-guide.md](./MCP/ai-native-epic-workflow-guide.md) | AI-native workflow patterns |
| [MCP/session-handoff.md](./MCP/session-handoff.md) | Cross-session context handoff |
| [MCP/ai-session-context.md](./MCP/ai-session-context.md) | Session context management |
| [MCP/execution-metadata.md](./MCP/execution-metadata.md) | Execution order and dependencies |
| [MCP/structured-descriptions.md](./MCP/structured-descriptions.md) | Rich structured descriptions |
| [MCP/code-context.md](./MCP/code-context.md) | Code file and function tracking |
| [MCP/validation-checklists.md](./MCP/validation-checklists.md) | Task validation and acceptance criteria |
| [MCP/decision-log.md](./MCP/decision-log.md) | Decision logging for accountability |
| [MCP/progress-tracking.md](./MCP/progress-tracking.md) | Progress tracking tools |
| [MCP/progress-summary.md](./MCP/progress-summary.md) | Progress dashboard for epics |
| [MCP/templates.md](./MCP/templates.md) | Implementation plan templates |
| [MCP/migration-guide.md](./MCP/migration-guide.md) | Migration guide for MCP updates |

---

## 🎯 Orchestrator

The orchestrator runs parallel AI agents to execute SpecTree epics automatically.

| Document | Description |
|----------|-------------|
| [orchestrator-architecture.md](./orchestrator-architecture.md) | Architecture overview |
| [orchestrator-implementation-briefing.md](./orchestrator-implementation-briefing.md) | Implementation details |
| [orchestrator-parallelism.md](./orchestrator-parallelism.md) | Parallel execution patterns |

---

## ☁️ Deployment

### Azure Deployment

| Document | Description | Audience |
|----------|-------------|----------|
| [azure-deployment-guide.md](./azure-deployment-guide.md) | Complete Azure deployment guide | Ops/DevOps |
| [azure-manual-deployment-runbook.md](./azure-manual-deployment-runbook.md) | Step-by-step manual deployment runbook | Ops |
| [DEPLOYMENT_REVIEW_ENG7.md](./DEPLOYMENT_REVIEW_ENG7.md) | Deployment review and post-mortem | Team |
| [bicep-secret-reference-pattern.md](./bicep-secret-reference-pattern.md) | Bicep pattern for secret references | Developers |
| [github-actions-azure-setup.md](./github-actions-azure-setup.md) | GitHub Actions CI/CD setup for Azure | DevOps |

---

## 📡 API Documentation

The API documentation is organized in the [api/](./api/) subdirectory:

| Document | Description |
|----------|-------------|
| [api/README.md](./api/README.md) | API overview and getting started |
| [api/ENDPOINT-INVENTORY.md](./api/ENDPOINT-INVENTORY.md) | Complete list of all API endpoints |
| [api/AUDIT-REPORT.md](./api/AUDIT-REPORT.md) | API quality audit report |

### Endpoint Documentation

| Document | Endpoints |
|----------|-----------|
| [api/auth-user-endpoints.md](./api/auth-user-endpoints.md) | Authentication and user management |
| [api/epic-endpoints.md](./api/epic-endpoints.md) | Epic CRUD operations |
| [api/feature-endpoints.md](./api/feature-endpoints.md) | Feature CRUD operations |
| [api/task-endpoints.md](./api/task-endpoints.md) | Task CRUD operations |
| [api/team-endpoints.md](./api/team-endpoints.md) | Team management |
| [api/status-endpoints.md](./api/status-endpoints.md) | Workflow statuses |
| [api/search-endpoints.md](./api/search-endpoints.md) | Search and filtering |
| [api/advanced-endpoints.md](./api/advanced-endpoints.md) | Advanced features (execution plans, validations) |
| [api/ai-context-endpoints.md](./api/ai-context-endpoints.md) | AI context and session management |
| [api/invitation-endpoints.md](./api/invitation-endpoints.md) | User invitation system |
| [api/template-endpoints.md](./api/template-endpoints.md) | Implementation plan templates |
| [api/validation-endpoints.md](./api/validation-endpoints.md) | Task validation checks |

---

## 🌿 Git Workflow

| Document | Description |
|----------|-------------|
| [GIT/git-release-flow-strategy-final-with-definitions.md](./GIT/git-release-flow-strategy-final-with-definitions.md) | Git release flow strategy with definitions |
| [GIT/git-release-flow-cheat-sheet.md](./GIT/git-release-flow-cheat-sheet.md) | Quick reference cheat sheet |

---

## 📚 Historical Documents

These documents represent pre-implementation planning, strategy analysis, and proposals that have been completed or archived for historical reference.

### Location
All historical documents are in [archive/](./archive/)

### Archived Planning Documents

Located in [archive/planning/](./archive/planning/):

| Document | Status | Notes |
|----------|--------|-------|
| [platform-improvements-plan-COMPLETED.md](./archive/planning/platform-improvements-plan-COMPLETED.md) | ✅ Completed | All 5 epics implemented (MCP consolidation, SSE, test isolation, viz, changelog) |
| [template-enhancement-instructions-COMPLETED.md](./archive/planning/template-enhancement-instructions-COMPLETED.md) | ✅ Completed | Template system enhanced with structured descriptions |
| [spectree-automation-tool-strategy.md](./archive/planning/spectree-automation-tool-strategy.md) | 📜 Historical | Original automation tool strategy (128KB) |
| [copilot-cli-automation-strategy.md](./archive/planning/copilot-cli-automation-strategy.md) | 📜 Historical | Copilot CLI integration strategy |
| [automation-epic-prompts.md](./archive/planning/automation-epic-prompts.md) | 📜 Historical | Automation epic prompt templates |
| [ai-enhancement-proposals.md](./archive/planning/ai-enhancement-proposals.md) | 📜 Historical | AI enhancement proposals |
| [user-registration-options-analysis.md](./archive/planning/user-registration-options-analysis.md) | 📜 Reference | Analysis of user registration approaches |

### Archived Analysis Documents

Located in [archive/analysis/](./archive/analysis/):

| Document | Status | Notes |
|----------|--------|-------|
| [analysis-spectree-mcp-vs-copilot-sdk.md](./archive/analysis/analysis-spectree-mcp-vs-copilot-sdk.md) | 📜 Historical | MCP vs Copilot SDK comparison (chose MCP) |
| [ai-framework-compliance-analysis.md](./archive/analysis/ai-framework-compliance-analysis.md) | 📜 Historical | Analysis of AI agent instruction compliance |
| [platform-analysis-for-spectree-orchestrator.md](./archive/analysis/platform-analysis-for-spectree-orchestrator.md) | 📜 Historical | Platform choice analysis for orchestrator |

---

## 🔍 Finding Documentation

### By Use Case

**"I need to set up SpecTree locally"**  
→ [SETUP_GUIDE.md](./SETUP_GUIDE.md)

**"I want to use AI automation"**  
→ [automation-quickstart.md](./automation-quickstart.md)  
→ [MCP/ai-native-epic-workflow-guide.md](./MCP/ai-native-epic-workflow-guide.md)

**"I'm deploying to Azure"**  
→ [azure-deployment-guide.md](./azure-deployment-guide.md)  
→ [azure-manual-deployment-runbook.md](./azure-manual-deployment-runbook.md)

**"I need API documentation"**  
→ [api/README.md](./api/README.md)  
→ [api/ENDPOINT-INVENTORY.md](./api/ENDPOINT-INVENTORY.md)

**"I'm building an MCP client/agent"**  
→ [MCP/tools-reference.md](./MCP/tools-reference.md)  
→ [MCP/IMPLEMENTATION-REFERENCE.md](./MCP/IMPLEMENTATION-REFERENCE.md)

**"I'm working on the orchestrator"**  
→ [orchestrator-implementation-briefing.md](./orchestrator-implementation-briefing.md)  
→ [orchestrator-parallelism.md](./orchestrator-parallelism.md)

**"Something broke, help!"**  
→ [mcp-auth-fix-summary.md](./mcp-auth-fix-summary.md)  
→ [database-safety-guide.md](./database-safety-guide.md)

---

## 📝 Document Conventions

### Status Indicators

- **Current** - Active, up-to-date documentation
- **Implemented ✅** - Feature/system has been implemented
- **📜 Historical** - Pre-implementation planning or analysis
- **📜 Reference** - Historical but still valuable for reference

### Document Naming

- **UPPERCASE.md** - Major guides (SETUP_GUIDE.md, README.md)
- **kebab-case.md** - Regular documentation
- **-COMPLETED.md** suffix - Archived planning docs that were fully implemented

---

## 🤝 Contributing

When adding new documentation:

1. **Add it to this index** under the appropriate category
2. **Use clear, descriptive names** following the naming conventions above
3. **Add status indicators** (Current, Historical, etc.)
4. **Link from related documents** to improve discoverability
5. **Archive old planning docs** to `archive/planning/` or `archive/analysis/` once implemented

---

## 📬 Questions?

- Check the [SETUP_GUIDE.md](./SETUP_GUIDE.md) for common setup issues
- Review [MCP/tools-reference.md](./MCP/tools-reference.md) for MCP usage
- See [CONTRIBUTING.md](../CONTRIBUTING.md) for contribution guidelines
