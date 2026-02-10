# Documentation Conventions

## Naming Rules

### General Principles
- **Folders**: All folder names use lowercase kebab-case (e.g., `database/`, `orchestrator/`, `azure-deployment/`)
- **Files**: All markdown files use lowercase kebab-case with `.md` extension (e.g., `azure-deployment-guide.md`, `database-safety-guide.md`)
- **Exceptions**: 
  - `README.md` files at repository root and `docs/` level maintain uppercase naming for ecosystem compatibility
  - `.DS_Store` and other system files are ignored

### Rationale
- **Consistency**: Uniform naming makes documentation easier to navigate and search
- **URL-friendly**: Kebab-case translates cleanly to URLs and file paths
- **Git-friendly**: Lowercase avoids issues with case-insensitive filesystems
- **Industry standard**: Aligns with common practices in modern documentation systems

---

## Folder Structure

The `docs/` directory is organized by topic area:

```
docs/
├── README.md                    # Documentation index and navigation
├── CONVENTIONS.md              # This file - naming and structure rules
├── deployment/                 # Deployment guides and configurations
├── database/                   # Database architecture and guides
├── orchestrator/               # Orchestrator system documentation
├── architecture/               # System architecture and design docs
├── guides/                     # General guides and tutorials
├── mcp/                        # MCP (Model Context Protocol) documentation
├── git/                        # Git workflows and conventions
├── api/                        # API documentation (existing)
└── archive/                    # Deprecated or historical docs (existing)
```

### Folder Purposes

- **deployment/**: Azure deployment guides, runbooks, GitHub Actions setup, infrastructure-as-code
- **database/**: Database schema, multi-provider support, safety guides, connection patterns
- **orchestrator/**: Architecture, implementation details, parallelism, briefing documents
- **architecture/**: System-wide architecture, design decisions, data models
- **guides/**: Setup guides, quickstarts, how-to documents
- **mcp/**: MCP server implementation, authentication, client integration
- **git/**: Git workflows, branching strategy, commit conventions
- **api/**: REST API documentation, endpoints, schemas (existing folder)
- **archive/**: Old documentation kept for reference (existing folder)

---

## Migration Plan

### Current Root Files → Destination Mapping

The following 18 files currently exist at `docs/` root and need to be moved:

#### Deployment (6 files)
- `azure-deployment-guide.md` → `deployment/azure-deployment-guide.md`
- `azure-manual-deployment-runbook.md` → `deployment/azure-manual-deployment-runbook.md`
- `github-actions-azure-setup.md` → `deployment/github-actions-azure-setup.md`
- `bicep-secret-reference-pattern.md` → `deployment/bicep-secret-reference-pattern.md`
- `secrets-provider.md` → `deployment/secrets-provider.md`
- `DEPLOYMENT_REVIEW_ENG7.md` → `deployment/deployment-review-eng7.md` *(rename to lowercase)*

#### Database (3 files)
- `database-multi-provider.md` → `database/database-multi-provider.md`
- `database-safety-guide.md` → `database/database-safety-guide.md`
- `secure-database-connection-evaluation.md` → `database/secure-database-connection-evaluation.md`

#### Orchestrator (3 files)
- `orchestrator-architecture.md` → `orchestrator/orchestrator-architecture.md`
- `orchestrator-implementation-briefing.md` → `orchestrator/orchestrator-implementation-briefing.md`
- `orchestrator-parallelism.md` → `orchestrator/orchestrator-parallelism.md`

#### Architecture (2 files)
- `identity-collaboration-vnext-implementation-reference.md` → `architecture/identity-collaboration-vnext-implementation-reference.md`
- `spectree-user-team-epic-model.md` → `architecture/spectree-user-team-epic-model.md`

#### Guides (2 files)
- `SETUP_GUIDE.md` → `guides/setup-guide.md` *(rename to lowercase)*
- `automation-quickstart.md` → `guides/automation-quickstart.md`

#### MCP (2 files)
- `MCP/` folder contents → `mcp/` *(folder rename + any file migrations)*
- `mcp-auth-fix-summary.md` → `mcp/mcp-auth-fix-summary.md`

#### Testing/Other (2 files)
- `manual-test-sse.md` → `guides/manual-test-sse.md` *(testing guide)*
- `user-invitation-system.md` → `architecture/user-invitation-system.md` *(system design)*

---

## macOS Case-Rename Workaround

### The Problem
macOS uses a case-insensitive but case-preserving filesystem (HFS+/APFS). This causes issues when:
1. You want to rename a folder from `MCP` to `mcp` (case-only change)
2. Git doesn't properly track case-only renames with a simple `git mv MCP mcp`
3. The filesystem considers `MCP` and `mcp` to be the same directory

### Two-Step Rename Process

For folders that need case-only renames (e.g., `MCP` → `mcp`, `GIT` → `git`):

#### Step 1: Rename to Temporary Name
```bash
# For MCP folder
git mv docs/MCP docs/mcp_temp
git commit -m "docs: rename MCP to temp (step 1 of case rename)"

# For GIT folder
git mv docs/GIT docs/git_temp
git commit -m "docs: rename GIT to temp (step 1 of case rename)"
```

#### Step 2: Rename to Final Lowercase Name
```bash
# For MCP folder
git mv docs/mcp_temp docs/mcp
git commit -m "docs: rename temp to mcp (step 2 of case rename)"

# For GIT folder
git mv docs/git_temp docs/git
git commit -m "docs: rename temp to git (step 2 of case rename)"
```

### Why This Works
1. **First rename**: Changes the name to something completely different (adds `_temp`)
2. Git tracks this as a legitimate rename operation
3. **Second rename**: Changes from temp name to final lowercase name
4. Git tracks this as another rename, completing the case change
5. Filesystem never sees a case-only rename, avoiding case-insensitivity issues

### Alternative: Direct Filesystem Manipulation
If you must do it in one commit (not recommended):
```bash
# Rename on filesystem to temp
mv docs/MCP docs/mcp_temp
# Rename to final
mv docs/mcp_temp docs/mcp
# Stage all changes
git add -A docs/
git commit -m "docs: rename MCP to mcp (case fix)"
```

---

## Migration Checklist

Track progress using this checklist. Complete migrations in order by folder to maintain organization.

### Phase 1: Create Folder Structure
- [ ] Create `docs/deployment/` folder
- [ ] Create `docs/database/` folder
- [ ] Create `docs/orchestrator/` folder
- [ ] Create `docs/architecture/` folder
- [ ] Create `docs/guides/` folder
- [ ] Create `docs/mcp/` folder (two-step rename from `docs/MCP/`)
- [ ] Create `docs/git/` folder (two-step rename from `docs/GIT/`)

### Phase 2: Migrate Files by Category

#### Deployment Files (6 files)
- [ ] Move `azure-deployment-guide.md` → `deployment/`
- [ ] Move `azure-manual-deployment-runbook.md` → `deployment/`
- [ ] Move `github-actions-azure-setup.md` → `deployment/`
- [ ] Move `bicep-secret-reference-pattern.md` → `deployment/`
- [ ] Move `secrets-provider.md` → `deployment/`
- [ ] Move & rename `DEPLOYMENT_REVIEW_ENG7.md` → `deployment/deployment-review-eng7.md`

#### Database Files (3 files)
- [ ] Move `database-multi-provider.md` → `database/`
- [ ] Move `database-safety-guide.md` → `database/`
- [ ] Move `secure-database-connection-evaluation.md` → `database/`

#### Orchestrator Files (3 files)
- [ ] Move `orchestrator-architecture.md` → `orchestrator/`
- [ ] Move `orchestrator-implementation-briefing.md` → `orchestrator/`
- [ ] Move `orchestrator-parallelism.md` → `orchestrator/`

#### Architecture Files (2 files)
- [ ] Move `identity-collaboration-vnext-implementation-reference.md` → `architecture/`
- [ ] Move `spectree-user-team-epic-model.md` → `architecture/`

#### Guides Files (2 files)
- [ ] Move & rename `SETUP_GUIDE.md` → `guides/setup-guide.md`
- [ ] Move `automation-quickstart.md` → `guides/`

#### MCP Files (2 items)
- [ ] Move contents from `MCP/` folder → `mcp/` (if any files exist)
- [ ] Move `mcp-auth-fix-summary.md` → `mcp/`

#### Testing/Other Files (2 files)
- [ ] Move `manual-test-sse.md` → `guides/`
- [ ] Move `user-invitation-system.md` → `architecture/`

### Phase 3: Update Documentation
- [ ] Update `docs/README.md` with new folder structure navigation
- [ ] Update any internal cross-references between documents
- [ ] Search codebase for hardcoded paths to moved files
- [ ] Update any CI/CD scripts that reference old paths

### Phase 4: Cleanup
- [ ] Verify all files have been moved (no orphaned files in root)
- [ ] Remove empty `MCP/` folder (if all contents moved)
- [ ] Remove empty `GIT/` folder (if all contents moved)
- [ ] Commit all changes with descriptive message

### Phase 5: Validation
- [ ] Verify all links in documentation still work
- [ ] Test any automated documentation generation
- [ ] Confirm CI/CD pipelines still pass
- [ ] Update team/contributor documentation about new structure

---

## Maintenance Guidelines

### When Adding New Documentation
1. **Choose the right folder**: Place documentation in the most specific applicable folder
2. **Use kebab-case**: All new files should use lowercase kebab-case naming
3. **Update README**: Add entry to `docs/README.md` navigation if it's a major document
4. **Cross-reference**: Link to related documents using relative paths

### When Renaming or Moving Files
1. **Update cross-references**: Search for the old filename and update all links
2. **Check code references**: Search codebase for any hardcoded paths
3. **Preserve git history**: Use `git mv` to maintain file history
4. **Document in commit**: Explain the rename/move in commit message

### Regular Reviews
- **Quarterly**: Review folder structure for emerging patterns that need new folders
- **After major features**: Check if new documentation category is needed
- **Archive old docs**: Move outdated documentation to `archive/` with timestamp

---

## References

- **Git best practices**: See `git/` folder for version control conventions
- **API documentation**: See `api/` folder for REST API documentation standards
- **Architecture decisions**: See `architecture/` folder for ADR (Architecture Decision Records)

---

*Last updated: 2026-02-10*
*Maintained by: SpecTree Engineering Team*
