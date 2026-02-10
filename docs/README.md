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
| [guides/setup-guide.md](./guides/setup-guide.md) | Complete setup instructions for local development | New developers |
| [guides/automation-quickstart.md](./guides/automation-quickstart.md) | Quick start guide for using SpecTree automation | AI/automation users |
| [guides/mcp-auth-fix-summary.md](./guides/mcp-auth-fix-summary.md) | Troubleshooting MCP authentication issues | Developers |

---

## 🏗️ Architecture & Design

### Core Architecture

| Document | Status | Notes |
|----------|--------|-------|
| [spectree-user-team-epic-model.md](./architecture/spectree-user-team-epic-model.md) | Current |
| [identity-collaboration-vnext-implementation-reference.md](./architecture/identity-collaboration-vnext-implementation-reference.md) | Implemented ✅ |
| [user-invitation-system.md](./architecture/user-invitation-system.md) | Current |

### Orchestrator Architecture

| Document | Description | Status |
|----------|-------------|--------|
| [orchestrator/orchestrator-architecture.md](./orchestrator/orchestrator-architecture.md) | High-level architecture of the parallel orchestrator | Current |
| [orchestrator/orchestrator-implementation-briefing.md](./orchestrator/orchestrator-implementation-briefing.md) | Detailed implementation guide | Current |
| [orchestrator/orchestrator-parallelism.md](./orchestrator/orchestrator-parallelism.md) | Parallel execution strategy and patterns | Current |

---

## 👨‍💻 Developer Guides

### Database

| Document | Description |
|----------|-------------|
| [database/database-safety-guide.md](./database/database-safety-guide.md) | Critical safety practices for database operations |
| [database/database-multi-provider.md](./database/database-multi-provider.md) | Multi-provider database strategy (SQLite/PostgreSQL) |
| [deployment/secrets-provider.md](./deployment/secrets-provider.md) | Azure Key Vault secrets management |
| [database/secure-database-connection-evaluation.md](./database/secure-database-connection-evaluation.md) | Database connection security evaluation |

### Testing

| Document | Description |
|----------|-------------|
| [guides/manual-test-sse.md](./guides/manual-test-sse.md) | Manual testing procedures for Server-Sent Events (SSE) |

---

## 🤖 MCP Server

SpecTree provides a Model Context Protocol (MCP) server that exposes 60+ tools for AI agents.

| Document | Description |
|----------|-------------|
| [mcp/IMPLEMENTATION-REFERENCE.md](./mcp/IMPLEMENTATION-REFERENCE.md) | Complete MCP implementation reference |
| [mcp/tools-reference.md](./mcp/tools-reference.md) | Tool reference with categories and descriptions |
| [mcp/api-token-authentication.md](./mcp/api-token-authentication.md) | API token authentication for MCP |
| [mcp/security-architecture.md](./mcp/security-architecture.md) | Security architecture and best practices |

### MCP Features

| Document | Feature |
|----------|---------|
| [mcp/ai-native-epic-workflow-guide.md](./mcp/ai-native-epic-workflow-guide.md) | AI-native workflow patterns |
| [mcp/session-handoff.md](./mcp/session-handoff.md) | Cross-session context handoff |
| [mcp/ai-session-context.md](./mcp/ai-session-context.md) | Session context management |
| [mcp/execution-metadata.md](./mcp/execution-metadata.md) | Execution order and dependencies |
| [mcp/structured-descriptions.md](./mcp/structured-descriptions.md) | Rich structured descriptions |
| [mcp/code-context.md](./mcp/code-context.md) | Code file and function tracking |
| [mcp/validation-checklists.md](./mcp/validation-checklists.md) | Task validation and acceptance criteria |
| [mcp/decision-log.md](./mcp/decision-log.md) | Decision logging for accountability |
| [mcp/progress-tracking.md](./mcp/progress-tracking.md) | Progress tracking tools |
| [mcp/progress-summary.md](./mcp/progress-summary.md) | Progress dashboard for epics |
| [mcp/templates.md](./mcp/templates.md) | Implementation plan templates |
| [mcp/migration-guide.md](./mcp/migration-guide.md) | Migration guide for MCP updates |

---

## 🎯 Orchestrator

The orchestrator runs parallel AI agents to execute SpecTree epics automatically.

| Document | Description |
|----------|-------------|
| [orchestrator/orchestrator-architecture.md](./orchestrator/orchestrator-architecture.md) | Architecture overview |
| [orchestrator/orchestrator-implementation-briefing.md](./orchestrator/orchestrator-implementation-briefing.md) | Implementation details |
| [orchestrator/orchestrator-parallelism.md](./orchestrator/orchestrator-parallelism.md) | Parallel execution patterns |

---

## ☁️ Deployment

### Azure Deployment

| Document | Description | Audience |
|----------|-------------|----------|
| [deployment/azure-deployment-guide.md](./deployment/azure-deployment-guide.md) | Complete Azure deployment guide | Ops/DevOps |
| [deployment/azure-manual-deployment-runbook.md](./deployment/azure-manual-deployment-runbook.md) | Step-by-step manual deployment runbook | Ops |
| [guides/deployment-review-eng7.md](./guides/deployment-review-eng7.md) | Deployment review and post-mortem | Team |
| [deployment/bicep-secret-reference-pattern.md](./deployment/bicep-secret-reference-pattern.md) | Bicep pattern for secret references | Developers |
| [deployment/github-actions-azure-setup.md](./deployment/github-actions-azure-setup.md) | GitHub Actions CI/CD setup for Azure | DevOps |

---

## 📡 API Documentation

The API documentation is organized in the [api/](./api/) subdirectory:

| Document | Description |
|----------|-------------|
| [api/README.md](./api/README.md) | API overview and getting started |

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
| [git/git-release-flow-strategy-final-with-definitions.md](./git/git-release-flow-strategy-final-with-definitions.md) | Git release flow strategy with definitions |
| [git/git-release-flow-cheat-sheet.md](./git/git-release-flow-cheat-sheet.md) | Quick reference cheat sheet |

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
→ [guides/setup-guide.md](./guides/setup-guide.md)

**"I want to use AI automation"**  
→ [guides/automation-quickstart.md](./guides/automation-quickstart.md)  
→ [mcp/ai-native-epic-workflow-guide.md](./mcp/ai-native-epic-workflow-guide.md)

**"I'm deploying to Azure"**  
→ [deployment/azure-deployment-guide.md](./deployment/azure-deployment-guide.md)  
→ [deployment/azure-manual-deployment-runbook.md](./deployment/azure-manual-deployment-runbook.md)

**"I need API documentation"**  
→ [api/README.md](./api/README.md)  

**"I'm building an MCP client/agent"**  
→ [mcp/tools-reference.md](./mcp/tools-reference.md)  
→ [mcp/IMPLEMENTATION-REFERENCE.md](./mcp/IMPLEMENTATION-REFERENCE.md)

**"I'm working on the orchestrator"**  
→ [orchestrator/orchestrator-implementation-briefing.md](./orchestrator/orchestrator-implementation-briefing.md)  
→ [orchestrator/orchestrator-parallelism.md](./orchestrator/orchestrator-parallelism.md)

**"Something broke, help!"**  
→ [guides/mcp-auth-fix-summary.md](./guides/mcp-auth-fix-summary.md)  
→ [database/database-safety-guide.md](./database/database-safety-guide.md)

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

- Check the [guides/setup-guide.md](./guides/setup-guide.md) for common setup issues
- Review [mcp/tools-reference.md](./mcp/tools-reference.md) for MCP usage
- See [CONTRIBUTING.md](../CONTRIBUTING.md) for contribution guidelines
