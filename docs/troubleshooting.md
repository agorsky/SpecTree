# SpecTree Troubleshooting Guide

Comprehensive solutions for common issues during installation, setup, and usage of SpecTree.

---

## 🔍 Quick Diagnostics

Before diving into specific issues, run these diagnostic checks:

```bash
# Check SpecTree CLI version
spectree --version

# Check API health
curl http://localhost:3001/health

# List installed skill packs
spectree list

# Check MCP server connectivity (in GitHub Copilot)
@spectree help
```

---

## Installation Issues

### Command Not Found: `spectree`

**Symptom:** Running `spectree` in terminal shows "command not found"

**Likely Causes:**
1. CLI not installed globally
2. npm/pnpm global bin directory not in PATH
3. Installation failed silently

**Solution:**

**Option 1: Install globally**
```bash
npm install -g @spectree/cli
# or
pnpm install -g @spectree/cli
```

**Option 2: Use npx (no global install)**
```bash
npx @spectree/cli list
npx @spectree/cli install @spectree/full
```

**Option 3: Fix PATH**

Add npm/pnpm global bin to PATH:

```bash
# For npm
export PATH="$PATH:$(npm config get prefix)/bin"

# For pnpm
export PATH="$PATH:$(pnpm bin -g)"
```

Add to `~/.bashrc` or `~/.zshrc` to persist.

**Verify:**
```bash
which spectree
# Should show path to CLI
```

---

### Installation Fails: Permission Denied

**Symptom:** 
```
Error: EACCES: permission denied, mkdir '/usr/local/lib/node_modules/@spectree'
```

**Likely Causes:**
- Installing globally without sudo (not recommended)
- npm configured with system directories

**Solution:**

**Option 1: Use npx (recommended)**
```bash
npx @spectree/cli install @spectree/full
```

**Option 2: Fix npm permissions (macOS/Linux)**
```bash
# Change npm's default directory
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH=~/.npm-global/bin:$PATH
source ~/.bashrc  # or ~/.zshrc

# Now install globally
npm install -g @spectree/cli
```

**Option 3: Use sudo (not recommended)**
```bash
sudo npm install -g @spectree/cli
```

---

### Pack Installation Fails: Download Timeout

**Symptom:**
```
Error: Request timeout downloading @spectree/planning
```

**Likely Causes:**
1. Network connectivity issues
2. Registry server down
3. Firewall blocking requests

**Solution:**

**Check network:**
```bash
ping spectree.io
curl -I https://registry.spectree.io/health
```

**Retry with increased timeout:**
```bash
spectree install @spectree/planning --timeout 120
```

**Check firewall settings:**
- Ensure outbound HTTPS (port 443) is allowed
- Whitelist `registry.spectree.io`

**Use alternative registry (if available):**
```bash
spectree install @spectree/planning --registry https://backup-registry.spectree.io
```

---

## MCP Connectivity

### MCP Server Not Responding

**Symptom:** GitHub Copilot shows "MCP server 'spectree' not responding"

**Likely Causes:**
1. MCP server not configured in Copilot settings
2. SpecTree API not running
3. Invalid API token
4. MCP server binary not found

**Solution:**

**Step 1: Verify MCP configuration**

Check `~/.config/github-copilot/config.json`:

```json
{
  "mcp": {
    "servers": {
      "spectree": {
        "command": "npx",
        "args": ["@spectree/mcp"],
        "env": {
          "API_BASE_URL": "http://localhost:3001",
          "API_TOKEN": "your-token-here"
        }
      }
    }
  }
}
```

**Step 2: Verify API is running**

```bash
curl http://localhost:3001/health
# Expected: {"status":"ok"}
```

If not running:
```bash
cd /path/to/SpecTree
pnpm --filter @spectree/api dev
```

**Step 3: Verify API token**

Get a valid token:
1. Open http://localhost:5173
2. Login with credentials
3. Go to Settings → API Tokens
4. Create new token
5. Copy to MCP config

**Step 4: Restart GitHub Copilot**

After config changes:
1. Quit GitHub Copilot completely
2. Reopen your editor
3. Test: `@spectree help`

---

### Invalid API Token Error

**Symptom:**
```
Error: Unauthorized - Invalid API token
```

**Likely Causes:**
1. Token expired
2. Token revoked
3. Token copied incorrectly (extra spaces)
4. Wrong API URL

**Solution:**

**Generate new token:**

1. Navigate to http://localhost:5173/settings/api-tokens
2. Click "Create Token"
3. Give it a name (e.g., "MCP Server")
4. Copy the token **exactly** (trim whitespace)
5. Update MCP config `API_TOKEN`
6. Restart Copilot

**Verify token format:**

Valid token format: 32-character alphanumeric string

**Check for whitespace:**
```bash
# In your MCP config, ensure:
"API_TOKEN": "abc123xyz456..."  # No quotes within, no spaces
```

**Test token manually:**
```bash
curl http://localhost:3001/api/v1/epics \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Should return epic list, not 401.

---

### MCP Tools Not Available in Copilot

**Symptom:** Typing `@spectree` shows no suggestions

**Likely Causes:**
1. MCP server not configured
2. Skill packs not installed
3. Copilot cache not refreshed

**Solution:**

**Check skill pack installation:**
```bash
spectree list
```

Ensure packs are installed:
- `@spectree/core` (minimum required)
- `@spectree/planning` (for planner agent)
- `@spectree/orchestrator` (for orchestration)

**Install missing packs:**
```bash
spectree install @spectree/full
```

**Clear Copilot cache:**
```bash
# macOS/Linux
rm -rf ~/.config/github-copilot/cache

# Windows
rmdir /s %APPDATA%\github-copilot\cache
```

**Restart Copilot and test:**
```
@spectree help
```

---

## CLI Errors

### "Pack Not Found" Error

**Symptom:**
```
Error: Pack '@spectree/planning' not found in registry
```

**Likely Causes:**
1. Typo in pack name
2. Pack doesn't exist in registry
3. Registry connection issue

**Solution:**

**List available packs:**
```bash
spectree list --available
```

**Check pack name spelling:**

Common mistakes:
- `@spectree/planner` ❌ → `@spectree/planning` ✅
- `@spectree/orchestrate` ❌ → `@spectree/orchestrator` ✅

**Verify registry connectivity:**
```bash
curl https://registry.spectree.io/api/v1/skill-packs
```

---

### Update Fails: Local Changes Detected

**Symptom:**
```
Error: Cannot update @spectree/planning - local changes detected
Files modified:
  - .github/copilot-instructions/@spectree/planning/agents/planner.md
```

**Likely Causes:**
- You've edited pack files manually
- Git has uncommitted changes

**Solution:**

**Option 1: Commit local changes first**
```bash
git add .github/copilot-instructions/
git commit -m "Custom modifications to planner"
spectree update @spectree/planning
```

**Option 2: Stash changes temporarily**
```bash
git stash
spectree update @spectree/planning
git stash pop  # Merge changes back
```

**Option 3: Force update (loses local changes)**
```bash
spectree update @spectree/planning --force
```

⚠️ **Warning:** `--force` will overwrite your changes!

---

### Publish Fails: Validation Errors

**Symptom:**
```
Error: Pack validation failed
- agents/my-agent.md referenced in pack.json but file not found
- Invalid version format: "v1.0" (should be "1.0.0")
```

**Likely Causes:**
1. Incorrect file paths in `pack.json`
2. Invalid semver version
3. Missing required fields

**Solution:**

**Fix file paths:**

Ensure paths in `pack.json` match actual files:
```json
{
  "agents": [
    {
      "path": "agents/my-agent.md"  // Must exist!
    }
  ]
}
```

**Fix version format:**

Use semantic versioning:
- ❌ `"v1.0"`, `"1.0"`, `"1"`
- ✅ `"1.0.0"`, `"1.2.3"`, `"2.0.0-beta.1"`

**Validate before publishing:**
```bash
spectree validate .
```

Fix all errors shown.

---

## Agent Not Following Instructions

### Agent Ignores AI Instructions

**Symptom:** Worker agent doesn't follow structured descriptions

**Likely Causes:**
1. Structured description not set properly
2. AI instructions too vague
3. Agent context window exceeded

**Solution:**

**Verify structured description exists:**
```
@spectree get structured description for task ENG-42-1-1
```

Should show `aiInstructions` field with content.

**Make instructions specific:**

**Bad:**
```
"Create the API endpoint"
```

**Good:**
```
"Create GET /api/v1/preferences endpoint in packages/api/src/routes/preferences.ts. Use Fastify route handler pattern. Return user preferences from Prisma UserPreferences model. Add Zod validation schema."
```

**Include file paths:**
```
"Edit packages/api/src/routes/preferences.ts"
"Run npx prisma db push after updating schema"
```

**Add safety rules:**
```
"NEVER run 'prisma migrate dev' - use 'npx prisma db push' instead"
```

---

### Agent Makes Wrong Assumptions

**Symptom:** Agent implements features differently than intended

**Likely Causes:**
1. Insufficient context
2. Missing acceptance criteria
3. Ambiguous requirements

**Solution:**

**Provide explicit context:**

Link related files:
```
@spectree link file to task ENG-42-1-1 "packages/api/src/routes/users.ts"
```

Reference in AI instructions:
```
"Follow the pattern in packages/api/src/routes/users.ts for route structure"
```

**Define clear acceptance criteria:**
```
@spectree add acceptance criterion to task ENG-42-1-1 "Endpoint returns 200 with valid JSON"
@spectree add acceptance criterion to task ENG-42-1-1 "Unauthorized requests return 401"
```

**Log decisions:**

When making implementation choices:
```
@spectree log decision "Use Zod for validation instead of Joi because Zod is already used in the project"
```

Future agents will see this context.

---

## Validation Failures

### Validation Check Always Fails

**Symptom:**
```
❌ test_passes: Unit tests pass
   Error: Command 'pnpm test' failed with exit code 1
```

**Likely Causes:**
1. Tests genuinely failing (fix tests!)
2. Wrong working directory
3. Missing environment variables
4. Test command incorrect

**Solution:**

**Run test command manually:**
```bash
cd /path/to/project
pnpm test --filter @spectree/api
```

Does it pass? If no, fix tests first.

**Specify working directory:**
```
@spectree add validation with workingDirectory "/Users/you/project/packages/api"
```

**Check environment variables:**

Some tests need env vars:
```bash
export DATABASE_URL="file:./test.db"
pnpm test
```

**Use specific test command:**

Instead of:
```bash
pnpm test
```

Use:
```bash
pnpm test --filter @spectree/api --run preferences.test.ts
```

---

### File Pattern Not Matching

**Symptom:**
```
❌ file_contains: Route handler exported
   Error: Pattern 'export default function' not found
```

**Likely Causes:**
1. Pattern too strict
2. File content doesn't match expectation
3. Regex escaping issues

**Solution:**

**Check file manually:**
```bash
grep "export default" packages/api/src/routes/preferences.ts
```

**Simplify pattern:**

Instead of:
```regex
export default function preferencesRoutes\(fastify: FastifyInstance\)
```

Use:
```regex
export default function
```

**Test regex separately:**
```bash
echo "export default function preferencesRoutes" | grep -E "your-pattern"
```

**Use multiple simpler checks:**

Instead of one complex check, use 2-3 simple checks:
1. File contains `export default`
2. File contains `function preferencesRoutes`
3. File contains `FastifyInstance`

---

### Manual Validation Stuck

**Symptom:** Task shows "Waiting for manual validation"

**Likely Causes:**
- Manual validation check requires human verification
- Forgot to mark as validated

**Solution:**

**List validations:**
```
@spectree list validations for task ENG-42-1-3
```

Find the manual check (type: `manual`).

**Mark as validated:**
```
@spectree mark manual validation <checkId> for task ENG-42-1-3 validated with notes "Verified in Chrome, looks good"
```

**If check is outdated:**

Remove it:
```
@spectree remove validation <checkId> from task ENG-42-1-3
```

---

## Performance Issues

### Orchestrator Runs Slowly

**Symptom:** Epic takes hours longer than estimated

**Likely Causes:**
1. Too many parallel workers (resource contention)
2. Tasks are more complex than estimated
3. Validation checks taking too long

**Solution:**

**Limit parallel workers:**
```
@orchestrator start session for epic ENG-42 with maxWorkers 2
```

Reduces CPU/memory pressure.

**Review complexity estimates:**

If tasks take 3x longer than estimated, update estimates:
```
@spectree set execution metadata for task ENG-42-1-1 with complexity complex
```

**Optimize validation checks:**

Remove slow checks:
```bash
# Instead of full build:
spectree add validation type command with command "pnpm build"  # Slow!

# Use type checking only:
spectree add validation type command with command "pnpm typecheck"  # Faster
```

---

### Database Queries Slow

**Symptom:** SpecTree UI/API is slow to load

**Likely Causes:**
1. Database not indexed properly
2. Large dataset without pagination
3. SQLite performance limits

**Solution:**

**Check database size:**
```bash
ls -lh spectree.db
```

If >100MB, consider PostgreSQL.

**Optimize queries:**

Run Prisma studio to inspect:
```bash
cd packages/api
pnpm exec prisma studio
```

**Switch to PostgreSQL (production):**

Update `DATABASE_URL` in `.env`:
```bash
DATABASE_URL="postgresql://user:pass@localhost:5432/spectree"
```

Run migrations:
```bash
pnpm --filter @spectree/api db:push
```

---

### MCP Tools Timeout

**Symptom:**
```
Error: MCP tool 'spectree__list_epics' timed out
```

**Likely Causes:**
1. API not responding
2. Large result set
3. Database locked

**Solution:**

**Check API logs:**
```bash
# In terminal running API
# Look for errors or slow queries
```

**Reduce result set:**

Use pagination:
```
@spectree list epics with limit 20
```

**Restart services:**
```bash
# Stop API and MCP
# Restart API
cd packages/api
pnpm dev

# Restart Copilot (automatic MCP restart)
```

---

## Still Stuck?

### Enable Debug Logging

**CLI:**
```bash
DEBUG=spectree:* spectree install @spectree/planning
```

**API:**
```bash
LOG_LEVEL=debug pnpm --filter @spectree/api dev
```

**MCP:**
```bash
# In MCP config
"env": {
  "DEBUG": "spectree:*"
}
```

### Check Logs

**API logs:**
```bash
# Terminal running API server
# Look for errors or warnings
```

**MCP logs (macOS/Linux):**
```bash
tail -f ~/.config/github-copilot/logs/mcp-server-spectree.log
```

**Browser console (web UI):**

Open DevTools → Console tab, check for errors.

### Get Support

If you're still experiencing issues:

1. **Check GitHub Issues:** [github.com/your-org/spectree/issues](https://github.com/your-org/spectree/issues)
2. **Open a new issue** with:
   - Operating system and version
   - SpecTree version (`spectree --version`)
   - Full error message
   - Steps to reproduce
   - Relevant logs
3. **Join community chat:** [Link to Slack/Discord]
4. **Email support:** support@spectree.dev

---

## Preventive Maintenance

### Weekly Checklist

✅ Check for skill pack updates: `spectree list`  
✅ Review API logs for errors  
✅ Backup database: `cp spectree.db spectree.db.backup`  
✅ Clear old Git branches  
✅ Update dependencies: `pnpm update`  

### Before Major Work

✅ Commit all changes: `git status`  
✅ Update skill packs: `spectree update --all`  
✅ Verify MCP connectivity: `@spectree help`  
✅ Test key workflows: Create test epic  

---

## Common Error Messages

Quick reference for error messages:

| Error | Solution |
|-------|----------|
| `ECONNREFUSED` | API not running or wrong URL |
| `ENOTFOUND` | Network/DNS issue or bad hostname |
| `401 Unauthorized` | Invalid or expired API token |
| `404 Not Found` | Wrong endpoint or resource doesn't exist |
| `EACCES permission denied` | File permission or install without sudo |
| `Validation failed` | Check pack structure with `spectree validate` |
| `Command not found` | CLI not installed or not in PATH |
| `MCP server not responding` | Check MCP config and restart Copilot |

---

## Related Documentation

- **[Quick Start Guide](./quick-start.md)** — Installation and setup
- **[Architecture Overview](./architecture/skill-packs.md)** — System design
- **[Workflow Cookbook](./cookbook/README.md)** — Step-by-step guides
