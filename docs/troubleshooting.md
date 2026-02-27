# Dispatcher Troubleshooting Guide

Comprehensive solutions for common issues during installation, setup, and usage of Dispatcher.

---

## 🔍 Quick Diagnostics

Before diving into specific issues, run these diagnostic checks:

```bash
# Check Dispatcher CLI version
dispatcher --version

# Check API health
curl http://localhost:3001/health

# List installed skill packs
dispatcher list

# Check MCP server connectivity (in GitHub Copilot)
@dispatcher help
```

---

## Installation Issues

### Command Not Found: `dispatcher`

**Symptom:** Running `dispatcher` in terminal shows "command not found"

**Likely Causes:**
1. CLI not installed globally
2. npm/pnpm global bin directory not in PATH
3. Installation failed silently

**Solution:**

**Option 1: Install globally**
```bash
npm install -g @dispatcher/cli
# or
pnpm install -g @dispatcher/cli
```

**Option 2: Use npx (no global install)**
```bash
npx @dispatcher/cli list
npx @dispatcher/cli install @dispatcher/full
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
which dispatcher
# Should show path to CLI
```

---

### Installation Fails: Permission Denied

**Symptom:** 
```
Error: EACCES: permission denied, mkdir '/usr/local/lib/node_modules/@dispatcher'
```

**Likely Causes:**
- Installing globally without sudo (not recommended)
- npm configured with system directories

**Solution:**

**Option 1: Use npx (recommended)**
```bash
npx @dispatcher/cli install @dispatcher/full
```

**Option 2: Fix npm permissions (macOS/Linux)**
```bash
# Change npm's default directory
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH=~/.npm-global/bin:$PATH
source ~/.bashrc  # or ~/.zshrc

# Now install globally
npm install -g @dispatcher/cli
```

**Option 3: Use sudo (not recommended)**
```bash
sudo npm install -g @dispatcher/cli
```

---

### Pack Installation Fails: Download Timeout

**Symptom:**
```
Error: Request timeout downloading @dispatcher/planning
```

**Likely Causes:**
1. Network connectivity issues
2. Registry server down
3. Firewall blocking requests

**Solution:**

**Check network:**
```bash
ping dispatcher.io
curl -I https://registry.dispatcher.io/health
```

**Retry with increased timeout:**
```bash
dispatcher install @dispatcher/planning --timeout 120
```

**Check firewall settings:**
- Ensure outbound HTTPS (port 443) is allowed
- Whitelist `registry.dispatcher.io`

**Use alternative registry (if available):**
```bash
dispatcher install @dispatcher/planning --registry https://backup-registry.dispatcher.io
```

---

## MCP Connectivity

### MCP Server Not Responding

**Symptom:** GitHub Copilot shows "MCP server 'dispatcher' not responding"

**Likely Causes:**
1. MCP server not configured in Copilot settings
2. Dispatcher API not running
3. Invalid API token
4. MCP server binary not found

**Solution:**

**Step 1: Verify MCP configuration**

Check `~/.config/github-copilot/config.json`:

```json
{
  "mcp": {
    "servers": {
      "dispatcher": {
        "command": "npx",
        "args": ["@dispatcher/mcp"],
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
cd /path/to/Dispatcher
pnpm --filter @dispatcher/api dev
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
3. Test: `@dispatcher help`

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

**Symptom:** Typing `@dispatcher` shows no suggestions

**Likely Causes:**
1. MCP server not configured
2. Skill packs not installed
3. Copilot cache not refreshed

**Solution:**

**Check skill pack installation:**
```bash
dispatcher list
```

Ensure packs are installed:
- `@dispatcher/core` (minimum required)
- `@dispatcher/planning` (for planner agent)
- `@dispatcher/orchestrator` (for orchestration)

**Install missing packs:**
```bash
dispatcher install @dispatcher/full
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
@dispatcher help
```

---

## CLI Errors

### "Pack Not Found" Error

**Symptom:**
```
Error: Pack '@dispatcher/planning' not found in registry
```

**Likely Causes:**
1. Typo in pack name
2. Pack doesn't exist in registry
3. Registry connection issue

**Solution:**

**List available packs:**
```bash
dispatcher list --available
```

**Check pack name spelling:**

Common mistakes:
- `@dispatcher/planner` ❌ → `@dispatcher/planning` ✅
- `@dispatcher/orchestrate` ❌ → `@dispatcher/orchestrator` ✅

**Verify registry connectivity:**
```bash
curl https://registry.dispatcher.io/api/v1/skill-packs
```

---

### Update Fails: Local Changes Detected

**Symptom:**
```
Error: Cannot update @dispatcher/planning - local changes detected
Files modified:
  - .github/copilot-instructions/@dispatcher/planning/agents/planner.md
```

**Likely Causes:**
- You've edited pack files manually
- Git has uncommitted changes

**Solution:**

**Option 1: Commit local changes first**
```bash
git add .github/copilot-instructions/
git commit -m "Custom modifications to planner"
dispatcher update @dispatcher/planning
```

**Option 2: Stash changes temporarily**
```bash
git stash
dispatcher update @dispatcher/planning
git stash pop  # Merge changes back
```

**Option 3: Force update (loses local changes)**
```bash
dispatcher update @dispatcher/planning --force
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
dispatcher validate .
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
@dispatcher get structured description for task ENG-42-1-1
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
@dispatcher link file to task ENG-42-1-1 "packages/api/src/routes/users.ts"
```

Reference in AI instructions:
```
"Follow the pattern in packages/api/src/routes/users.ts for route structure"
```

**Define clear acceptance criteria:**
```
@dispatcher add acceptance criterion to task ENG-42-1-1 "Endpoint returns 200 with valid JSON"
@dispatcher add acceptance criterion to task ENG-42-1-1 "Unauthorized requests return 401"
```

**Log decisions:**

When making implementation choices:
```
@dispatcher log decision "Use Zod for validation instead of Joi because Zod is already used in the project"
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
pnpm test --filter @dispatcher/api
```

Does it pass? If no, fix tests first.

**Specify working directory:**
```
@dispatcher add validation with workingDirectory "/Users/you/project/packages/api"
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
pnpm test --filter @dispatcher/api --run preferences.test.ts
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
@dispatcher list validations for task ENG-42-1-3
```

Find the manual check (type: `manual`).

**Mark as validated:**
```
@dispatcher mark manual validation <checkId> for task ENG-42-1-3 validated with notes "Verified in Chrome, looks good"
```

**If check is outdated:**

Remove it:
```
@dispatcher remove validation <checkId> from task ENG-42-1-3
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
@dispatcher set execution metadata for task ENG-42-1-1 with complexity complex
```

**Optimize validation checks:**

Remove slow checks:
```bash
# Instead of full build:
dispatcher add validation type command with command "pnpm build"  # Slow!

# Use type checking only:
dispatcher add validation type command with command "pnpm typecheck"  # Faster
```

---

### Database Queries Slow

**Symptom:** Dispatcher UI/API is slow to load

**Likely Causes:**
1. Database not indexed properly
2. Large dataset without pagination
3. SQLite performance limits

**Solution:**

**Check database size:**
```bash
ls -lh dispatcher.db
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
DATABASE_URL="postgresql://user:pass@localhost:5432/dispatcher"
```

Run migrations:
```bash
pnpm --filter @dispatcher/api db:push
```

---

### MCP Tools Timeout

**Symptom:**
```
Error: MCP tool 'dispatcher__list_epics' timed out
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
@dispatcher list epics with limit 20
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
DEBUG=dispatcher:* dispatcher install @dispatcher/planning
```

**API:**
```bash
LOG_LEVEL=debug pnpm --filter @dispatcher/api dev
```

**MCP:**
```bash
# In MCP config
"env": {
  "DEBUG": "dispatcher:*"
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
tail -f ~/.config/github-copilot/logs/mcp-server-dispatcher.log
```

**Browser console (web UI):**

Open DevTools → Console tab, check for errors.

### Get Support

If you're still experiencing issues:

1. **Check GitHub Issues:** [github.com/your-org/dispatcher/issues](https://github.com/your-org/dispatcher/issues)
2. **Open a new issue** with:
   - Operating system and version
   - Dispatcher version (`dispatcher --version`)
   - Full error message
   - Steps to reproduce
   - Relevant logs
3. **Join community chat:** [Link to Slack/Discord]
4. **Email support:** support@dispatcher.dev

---

## Preventive Maintenance

### Weekly Checklist

✅ Check for skill pack updates: `dispatcher list`  
✅ Review API logs for errors  
✅ Backup database: `cp dispatcher.db dispatcher.db.backup`  
✅ Clear old Git branches  
✅ Update dependencies: `pnpm update`  

### Before Major Work

✅ Commit all changes: `git status`  
✅ Update skill packs: `dispatcher update --all`  
✅ Verify MCP connectivity: `@dispatcher help`  
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
| `Validation failed` | Check pack structure with `dispatcher validate` |
| `Command not found` | CLI not installed or not in PATH |
| `MCP server not responding` | Check MCP config and restart Copilot |

---

## Related Documentation

- **[Quick Start Guide](./quick-start.md)** — Installation and setup
- **[Architecture Overview](./architecture/skill-packs.md)** — System design
- **[Workflow Cookbook](./cookbook/README.md)** — Step-by-step guides
