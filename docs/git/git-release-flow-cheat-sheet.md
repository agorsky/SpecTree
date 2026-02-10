# Git Release Flow – Cheat Sheet

> **⚠️ FUTURE WORKFLOW NOTICE**  
> This cheat sheet describes a **planned future workflow** for production releases with QA cycles.  
> **Current workflow**: Trunk-based development with continuous deployment from `main`.  
> See [`CONTRIBUTING.md`](../../CONTRIBUTING.md) for current guidelines.

---

**Quick Reference** | Full policy: [git-release-flow-strategy-final-with-definitions.md](git-release-flow-strategy-final-with-definitions.md)

---

## Branch Overview

| Branch | Purpose | Rules |
|--------|---------|-------|
| `main` | Next release in development | PR-only, always buildable |
| `release/x.y` | Stabilization for QA/Lab | **Fix-only**, temporary, deleted after release |
| `feature/<ticket>-<desc>` | New functionality | From `main`, PR back to `main` |
| `bugfix/<ticket>-<desc>` | Defect fixes | From `main` or `release/*`, PR to source |
| `hotfix/<ticket>-<desc>` | Urgent production fixes | From recreated `release/*` tag |

> **No version numbers in branch names.** PR target determines the release train.

*Full details: Sections 4–6 of main policy*

---

## Standard Workflow

```
1. Create branch from main     →  feature/TICKET-123-add-widget
2. Do work, commit             →  Small, logical commits
3. Open PR to main             →  Link Issue, get review
4. Squash merge                →  Clean history on main
```

*Full details: Section 7 of main policy*

---

## Release Cycle

### Phase 1: Cut Release Branch
```
main ─────●─────●─────●─────●─────●───── (continues as 9.2 development)
           \
            └──→ release/9.1 created
                      │
                      ▼
                Tag v9.1.0-rc1 → Hand off to QA/Lab
```

### Phase 2: QA Stabilization (iterate until QA passes)
```
release/9.1:  ──●──────────●──────────●──────
                │          │          │
                rc1        rc2        rc3
                │          │
                ▼          ▼
             QA tests   QA finds bug → bugfix branch → PR to release/9.1
                                                              │
                                                              ▼
                                                    Forward-port to main
```

### Phase 3: Ship & Cleanup
```
QA passes final RC
        │
        ▼
Tag v9.1.0 (final release)
        │
        ▼
Verify all fixes forward-ported to main
        │
        ▼
Delete release/9.1 branch
```

**Key points:**
- `main` never stops – 9.2 development continues immediately after release branch is cut
- QA tests **tags** (rc1, rc2, etc.), not the branch directly
- Every fix on `release/9.1` must be forward-ported to `main`
- Release branch is deleted after stabilization

*Full details: Sections 7, 10, and Release Branch Lifecycle in Section 4 of main policy*

---

## The Golden Rules

### 1. Fix-Only on Release Branches ⚠️
**This is the most critical rule.**

| ✅ Allowed | ❌ Not Allowed |
|-----------|---------------|
| Bug fixes | New features |
| Minimal diagnostics | Refactors |
| Stability guard-rails | "While I'm here" changes |

> Violation creates multiple development branches – the exact problem this workflow prevents.

*Full details: Section 9 of main policy*

### 2. Forward-Port All Release Fixes
Every fix on `release/*` **must** reach `main` within 2 business days.

```
release/9.0 → release/9.1 → main
     ↑              ↑          ↑
   hotfix      forward-port  forward-port
```

*Full details: Sections 11–12 of main policy*

### 3. QA Tests Tags, Not Branches
- RC tags (`v9.1.0-rc1`, `v9.1.0-rc2`) are immutable snapshots
- Never rewrite history on `release/*` after RCs exist

*Full details: Section 2 (Definitions) and Section 22 of main policy*

---

## Quick Decision Guide

### "Where do I branch from?"

| Situation | Branch From |
|-----------|-------------|
| New feature for next release | `main` |
| Bug found in current dev | `main` |
| Bug found by QA/Lab in `release/9.1` | `release/9.1` |
| Urgent hotfix for production 9.0 | Recreate `release/9.0` from tag |

### "Where does my PR go?"

| Situation | PR Target |
|-----------|-----------|
| Feature work | `main` |
| Fix for bug in `main` | `main` |
| Fix for QA/Lab issue | `release/x.y` where found |
| After fixing in `release/*` | **Also** forward-port PR to `main` |

*Full details: Sections 7, 10, 13–14 of main policy*

---

## Forward-Port Quick Reference

**Preferred method:** Merge-forward
```bash
git checkout main
git merge release/9.1
# Resolve conflicts if any
# Open PR
```

**Expedited review:** Conflict-free forward-ports need only single reviewer approval.

**Cherry-pick:** Exception only – must justify why merge-forward wasn't used.

*Full details: Sections 11, 18, and 21.5 of main policy*

---

## Merge Strategies

| PR Type | Strategy |
|---------|----------|
| Feature/bugfix → `main` | Squash merge |
| Bugfix → `release/*` | Squash merge |
| Forward-port → `main` | Regular merge (preserves lineage) |

*Full details: Section 21 of main policy*

---

## Rebasing Rules

| ✅ Allowed | ❌ Not Allowed |
|-----------|---------------|
| Private branch before PR | Any shared branch |
| Private branch after PR opened (with caution) | `release/*` after RC tags |
| Cleaning up commits before review | Moving fixes between release trains |

*Full details: Section 2 (Rebase Policy Rationale) of main policy*

---

## PR Checklist

For **all PRs**:
- [ ] Linked to Issue (`Fixes #123`)
- [ ] Target branch justified
- [ ] CI passes

For **release branch PRs**, also:
- [ ] `release-fix` label applied
- [ ] Fix-only change confirmed
- [ ] Forward-port plan documented

*Full details: Section 17 of main policy*

---

## Customer Bug Response

```
Bug reported on old version (e.g., 9.0)
            ↓
    Reproducible on latest?
       /          \
     No            Yes
      ↓             ↓
  "Please      Hotfix needed?
  upgrade"        /      \
                No        Yes
                 ↓         ↓
            Fix in     Create release/9.0
            main       from tag, fix,
            (next      forward-port
            release)
```

*Full details: Section 13 of main policy*

---

## Emergency Contacts

| Role | Responsibility |
|------|---------------|
| **Release Manager** | All release decisions, fix-only approvals |
| **Tech Lead** | Backup when RM unavailable |
| **Engineering Manager** | Final escalation |

**Emergency bypass:** Allowed only for P1/S1 issues when RM unreachable for 1+ hour. Document everything.

*Full details: Section 19 of main policy*

---

## Labels Quick Reference

| Label | Meaning |
|-------|---------|
| `release-fix` | Required for any PR to `release/*` |
| `needs-forward-port` | Fix merged to release, forward-port pending |
| `forward-port` | This PR is a forward-port |
| `forward-port-blocked` | Conflicts need escalation |

*Full details: Section 20 of main policy*

---

## One-Liner Reminders

- **Fixes flow forward, never backward** (older → newer)
- **No direct commits** to `main` or `release/*` – PR only
- **Tags are immutable** – QA approval tied to specific commits
- **Release branches are temporary** – delete after stabilization
- **When in doubt, ask Release Manager**

---

*Full rationale and detailed scenarios: [git-release-flow-strategy-final-with-definitions.md](git-release-flow-strategy-final-with-definitions.md)*
