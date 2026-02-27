# Updating Skill Packs

Keep your Dispatcher skill packs up-to-date with the latest features, fixes, and improvements. This guide covers checking for updates, updating packs, and troubleshooting update issues.

**Time Estimate:** ~5 minutes

---

## Prerequisites

- **Skill packs installed** — At least one pack in `.github/copilot-instructions/`
- **Dispatcher CLI available** — Run `dispatcher --version` to verify
- **Git working directory clean** — Updates modify files, commit changes first
- **Registry configured** — Either use `--registry` flag or set `SPECTREE_REGISTRY_URL` env var

**Verify installed packs:**
```bash
# With registry flag:
dispatcher list --registry https://your-dispatcher-instance.com

# Or set env var once:
export SPECTREE_REGISTRY_URL=https://your-dispatcher-instance.com
dispatcher list    # Uses SPECTREE_REGISTRY_URL
```

> **Note:** All CLI commands in this guide assume you've either set `SPECTREE_REGISTRY_URL` or will add `--registry <url>` to each command.

---

## Why Update?

Skill pack updates provide:

- ✨ **New features** — Additional agents, skills, or instructions
- 🐛 **Bug fixes** — Corrected AI instructions or broken workflows
- 🔒 **Security patches** — Updated dependencies or safer patterns
- 📚 **Improved documentation** — Clearer instructions for agents
- ⚡ **Performance** — Faster, more efficient workflows

**Check for updates regularly** (weekly or before major work).

---

## Checking for Updates

### Option 1: List Installed with Update Status

```bash
dispatcher list
```

**Output:**

```
Installed Skill Packs:

  @dispatcher/planning       1.2.0  →  1.3.0 available  ⚠️
  @dispatcher/orchestrator   0.5.0  (up-to-date)       ✅
  @dispatcher/core           1.0.1  →  1.1.0 available  ⚠️

Total: 3 packs installed (2 updates available)
```

### Option 2: Check Specific Pack

```bash
dispatcher list @dispatcher/planning
```

**Output:**

```
@dispatcher/planning

  Installed Version: 1.2.0
  Latest Version:    1.3.0
  Update Available:  Yes ⚠️
  
  Release Notes (1.3.0):
    - Added @plan-reviewer agent for validation
    - Improved epic decomposition accuracy
    - Fixed bug in dependency detection
  
  Update: dispatcher update @dispatcher/planning
```

### Option 3: Via MCP Tools

In GitHub Copilot:

```
@dispatcher list installed packs
```

Shows status with update reminders.

---

## Updating Packs

### Update Single Pack

```bash
dispatcher update @dispatcher/planning
```

**What happens:**

1. Downloads latest version manifest
2. Backs up current installation
3. Removes old files
4. Installs new files
5. Updates local manifest
6. Shows release notes

**Output:**

```
🔄 Updating @dispatcher/planning...

Current version: 1.2.0
Latest version:  1.3.0

📦 Downloading @dispatcher/planning@1.3.0...
🗑️  Removing old files (4 files)...
📁 Installing new files (5 files)...
✅ Updated local manifest

✅ Successfully updated @dispatcher/planning to 1.3.0

What's new in 1.3.0:
  - Added @plan-reviewer agent for validation
  - Improved epic decomposition accuracy
  - Fixed bug in dependency detection

⚠️  Changes made to:
  .github/copilot-instructions/@dispatcher/planning/

Review the changes and commit:
  git status
  git diff
  git commit -m "Update @dispatcher/planning to 1.3.0"
```

### Update All Packs

Update everything at once:

```bash
dispatcher update --all
```

**Output:**

```
🔄 Checking for updates...

Updates available:
  @dispatcher/planning   1.2.0 → 1.3.0
  @dispatcher/core       1.0.1 → 1.1.0

Update all? (yes/no): yes

Updating @dispatcher/planning...
✅ Updated to 1.3.0

Updating @dispatcher/core...
✅ Updated to 1.1.0

Summary:
  ✅ 2 packs updated
  📁 12 files modified
  
Next: Review changes and commit to Git
```

### Update to Specific Version

```bash
dispatcher update @dispatcher/planning --version 1.2.5
```

Useful for:
- Reverting to a previous version
- Testing a specific release
- Avoiding prerelease versions

---

## Steps

### Step 1: Check for Updates

Before updating, see what's available:

```bash
dispatcher list
```

### Step 2: Review Release Notes

Read what changed in the new version:

```bash
dispatcher list @dispatcher/planning
```

**Check for:**
- Breaking changes (major version bump)
- New features you want
- Bug fixes that affect you

### Step 3: Backup (Optional)

If you've made local modifications:

```bash
# Backup current installation
cp -r .github/copilot-instructions/@dispatcher .github/copilot-instructions/@dispatcher-backup

# Or commit to Git first
git add .
git commit -m "Checkpoint before updating skill packs"
```

### Step 4: Run Update

```bash
dispatcher update @dispatcher/planning
```

Or update all:

```bash
dispatcher update --all
```

### Step 5: Review Changes

Check what files were modified:

```bash
git status
git diff .github/copilot-instructions/
```

**Look for:**
- ✅ Expected files updated
- ❌ Unexpected deletions
- ⚠️ Conflicts with local changes

### Step 6: Test the Update

Verify the updated packs work:

```bash
# Test in GitHub Copilot
@planner help
@orchestrator help
```

Should show help with updated features.

### Step 7: Commit Changes

If everything works:

```bash
git add .github/copilot-instructions/
git add .dispatcher/manifest.json
git commit -m "Update skill packs: @dispatcher/planning 1.2.0 → 1.3.0"
```

---

## Handling Breaking Changes

### Major Version Updates

Major version (e.g., `1.x.x` → `2.0.0`) may have breaking changes:

```
⚠️  BREAKING CHANGES in @dispatcher/planning@2.0.0:

  - Agent name changed: @planner → @dispatcher-planner
  - MCP tool renamed: dispatcher__plan_epic → dispatcher__create_from_template
  - Removed deprecated skill: epic-scoping

Migration required. See: https://docs.dispatcher.dev/migration-2.0

Continue? (yes/no):
```

**Steps:**

1. Read migration guide (link provided)
2. Update your workflows/scripts
3. Test thoroughly before committing
4. Consider staying on `1.x.x` if not ready

### Rollback to Previous Version

If update causes issues:

```bash
# Rollback to previous version
dispatcher update @dispatcher/planning --version 1.2.0
```

Or restore from Git:

```bash
git checkout HEAD -- .github/copilot-instructions/@dispatcher/planning
```

---

## Automated Updates

### Check for Updates in CI

Add to GitHub Actions workflow:

```yaml
- name: Check for Dispatcher pack updates
  run: |
    dispatcher list | grep "available"
    if [ $? -eq 0 ]; then
      echo "⚠️  Skill pack updates available!"
      dispatcher list
    fi
```

### Scheduled Update Reminders

Use GitHub Actions scheduled workflow:

```yaml
name: Dispatcher Update Check
on:
  schedule:
    - cron: '0 9 * * MON'  # Every Monday at 9am
jobs:
  check-updates:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check for updates
        run: dispatcher list
```

---

## Common Pitfalls

### "Cannot update: local changes detected"

**Problem:** You've modified pack files locally  
**Solution:** Commit or stash local changes first:

```bash
git stash
dispatcher update @dispatcher/planning
git stash pop
```

Then merge conflicts if any.

### Update Fails Midway

**Problem:** Download interrupted or file write error  
**Solution:** CLI should auto-rollback, but verify:

```bash
# Check installation status
dispatcher list @dispatcher/planning

# If corrupted, reinstall
dispatcher uninstall @dispatcher/planning
dispatcher install @dispatcher/planning
```

### New Version Breaks Workflows

**Problem:** Updated pack has regressions or bugs  
**Solution:** Report issue and rollback:

```bash
# Rollback
dispatcher update @dispatcher/planning --version 1.2.0

# Report issue
# Open GitHub issue with version details
```

### Dependency Conflicts

**Problem:** Update requires updating other packs  
**Solution:** Update dependencies first:

```
⚠️  Dependency conflict detected:

@dispatcher/planning@1.3.0 requires @dispatcher/core@^1.1.0
You have @dispatcher/core@1.0.1 installed

Update @dispatcher/core first? (yes/no):
```

Select `yes` to update dependencies automatically.

---

## Best Practices

### 1. Update Regularly

Check for updates weekly or biweekly:

```bash
# Add to your routine
dispatcher list
```

Don't let packs get too far behind.

### 2. Read Release Notes

Always review what changed before updating:

```bash
dispatcher list @dispatcher/planning
```

Understand new features and breaking changes.

### 3. Test Before Committing

After update, test workflows:

- Run key agents (`@planner`, `@orchestrator`)
- Verify existing epics still work
- Check MCP tools respond correctly

### 4. Update on a Branch

For major updates, use a feature branch:

```bash
git checkout -b update-skill-packs
dispatcher update --all
# Test...
git commit
git push
# Open PR for review
```

### 5. Keep Local Manifest in Sync

After manual file changes, sync the manifest:

```bash
dispatcher sync-local-packs
```

Detects drift between files and manifest.

---

## Expected Output

After successful update:

✅ Pack updated to latest version  
✅ New files installed, old files removed  
✅ Local manifest updated  
✅ Changes committed to Git  
✅ Workflows tested and working  

**Time saved:** 30+ minutes per month by staying current with improvements

---

## Next Steps

- **[Creating a Custom Skill Pack](./custom-pack.md)** — Build your own packs for team use
- **[First Epic Guide](./first-epic.md)** — Try new features from updated packs

---

## What You Learned

✅ Checking for skill pack updates  
✅ Updating single or multiple packs  
✅ Reviewing and committing changes  
✅ Handling breaking changes and rollbacks  
✅ Best practices for safe updates  

**Pro Tip:** Subscribe to Dispatcher release notifications (GitHub Watch → Releases) to know when updates are available.
