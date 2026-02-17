# Creating a Custom Skill Pack

Build organization-specific skill packs with custom agents, skills, and instructions. This guide walks you through designing, creating, testing, and publishing your own pack.

**Time Estimate:** ~45 minutes

---

## Prerequisites

- **Understanding of Skill Pack structure** — Read [Architecture Overview](../architecture/skill-packs.md)
- **SpecTree CLI installed** — `spectree --version`
- **Existing agents/skills** to package (or create new ones)
- **Access to SpecTree registry** (for publishing)

**Skills needed:**
- Writing Markdown documentation
- Understanding GitHub Copilot agent format
- Basic JSON schema knowledge

---

## What You'll Create

Example: A custom pack for a fictional "Acme Corp" with:

- **Agent:** `@acme-deployer` — Deploys to Acme's infrastructure
- **Skill:** `acme-deployment-checklist` — Deployment workflow
- **Instructions:** `acme-conventions` — Coding standards and patterns

---

## Steps

### Step 1: Plan Your Pack

Define what your pack will contain:

**Questions to answer:**

1. **Purpose:** What problem does this solve?
2. **Audience:** Who will use it? (Team, org, public)
3. **Contents:** What agents, skills, instructions?
4. **Dependencies:** Does it require other packs?

**Example plan:**

```
Pack Name: @acme/deployment
Purpose: Standardize deployments across Acme Corp projects
Audience: Engineering team (internal)
Contents:
  - Agent: @acme-deployer (handles deployment workflow)
  - Skill: deployment-checklist (step-by-step guide)
  - Instructions: acme-conventions (coding standards)
Dependencies: @spectree/core (for MCP tools)
```

### Step 2: Create Pack Directory

Set up the directory structure:

```bash
mkdir -p my-custom-pack/{agents,skills,instructions}
cd my-custom-pack
```

**Directory structure:**

```
my-custom-pack/
├── pack.json              # Pack metadata
├── README.md              # Documentation
├── agents/
│   └── acme-deployer.md
├── skills/
│   └── deployment-checklist.md
└── instructions/
    └── acme-conventions.md
```

### Step 3: Write pack.json

Create the pack manifest:

```bash
touch pack.json
```

**Content:**

```json
{
  "name": "@acme/deployment",
  "version": "1.0.0",
  "displayName": "Acme Deployment Pack",
  "description": "Standardized deployment workflows for Acme Corp projects",
  "author": {
    "name": "Acme Engineering Team",
    "email": "engineering@acme.com",
    "url": "https://github.com/acme"
  },
  "homepage": "https://docs.acme.com/deployment-pack",
  "repository": "https://github.com/acme/deployment-pack",
  "license": "MIT",
  "agents": [
    {
      "name": "acme-deployer",
      "path": "agents/acme-deployer.md",
      "description": "Automated deployment agent for Acme infrastructure"
    }
  ],
  "skills": [
    {
      "name": "deployment-checklist",
      "path": "skills/deployment-checklist.md",
      "description": "Step-by-step deployment workflow"
    }
  ],
  "instructions": [
    {
      "name": "acme-conventions",
      "path": "instructions/acme-conventions.md",
      "description": "Acme coding standards and patterns"
    }
  ],
  "dependencies": {
    "@spectree/core": "^1.0.0"
  },
  "keywords": [
    "deployment",
    "acme",
    "devops",
    "automation"
  ]
}
```

**Key fields:**

- `name`: Must be unique (use org scope: `@your-org/pack-name`)
- `version`: Semantic versioning (`MAJOR.MINOR.PATCH`)
- `agents/skills/instructions`: Paths relative to pack root
- `dependencies`: Other packs required

### Step 4: Create Agent

Write your custom agent in `agents/acme-deployer.md`:

```markdown
# Acme Deployer Agent

You are an AI agent specialized in deploying applications to Acme Corp infrastructure.

## Your Role

Deploy applications to Acme's Kubernetes clusters following company standards:
- Use Acme's Helm charts
- Follow naming conventions
- Apply security policies
- Run pre-deployment checks

## Available Tools

You have access to:
- SpecTree MCP tools (via @spectree/core dependency)
- Acme deployment conventions (instructions/acme-conventions.md)
- Deployment checklist (skills/deployment-checklist.md)

## Workflow

When asked to deploy:

1. **Gather requirements:**
   - Application name
   - Environment (dev, staging, prod)
   - Configuration values

2. **Pre-deployment checks:**
   - Verify cluster access
   - Check resource quotas
   - Validate Helm chart

3. **Execute deployment:**
   - Use Helm to deploy
   - Apply Acme-specific labels
   - Configure monitoring

4. **Post-deployment verification:**
   - Check pod status
   - Verify health checks
   - Run smoke tests

5. **Document:**
   - Log deployment in SpecTree
   - Update deployment tracker
   - Notify team

## Example Usage

User: "Deploy my-app to staging"

You should:
1. Ask for missing details (version, config overrides)
2. Run pre-deployment checks
3. Execute Helm deployment
4. Verify deployment succeeded
5. Provide status report

## Safety Rules

- **NEVER deploy to production without explicit confirmation**
- Always run pre-deployment checks
- Fail fast on errors, don't retry blindly
- Log all actions in SpecTree for audit trail

## Error Handling

If deployment fails:
1. Capture error details
2. Rollback if possible
3. Report to user with clear explanation
4. Log incident in SpecTree
```

### Step 5: Create Skill

Write the skill in `skills/deployment-checklist.md`:

```markdown
# Deployment Checklist

Step-by-step workflow for deploying applications to Acme infrastructure.

## Prerequisites

- Application is built and containerized
- Helm chart exists in `helm/` directory
- Configuration values ready

## Steps

### 1. Pre-Deployment Checks

```bash
# Verify cluster access
kubectl cluster-info

# Check current deployments
kubectl get deployments -n <namespace>

# Validate Helm chart
helm lint helm/<app-name>
```

**Expected:** All checks pass, no errors

### 2. Review Configuration

```bash
# Check values file
cat helm/<app-name>/values-<env>.yaml
```

**Verify:**
- Image tag is correct
- Resource limits set
- Environment variables complete

### 3. Deploy with Helm

```bash
helm upgrade --install <app-name> helm/<app-name> \
  --namespace <namespace> \
  --values helm/<app-name>/values-<env>.yaml \
  --create-namespace \
  --wait
```

### 4. Verify Deployment

```bash
# Check pod status
kubectl get pods -n <namespace> -l app=<app-name>

# View logs
kubectl logs -n <namespace> -l app=<app-name> --tail=50

# Check health endpoint
curl https://<app-name>.<env>.acme.com/health
```

**Expected:** Pods running, health check returns 200

### 5. Update Documentation

- Log deployment in SpecTree: `@spectree log progress`
- Update deployment tracker spreadsheet
- Notify team in Slack

## Rollback Procedure

If deployment fails:

```bash
helm rollback <app-name> -n <namespace>
```

Verify previous version is running:

```bash
kubectl get deployments -n <namespace>
```

## Common Issues

### Pods CrashLooping

Check logs for errors:
```bash
kubectl logs -n <namespace> <pod-name>
```

### ImagePullBackOff

Verify image exists:
```bash
docker pull <image-name>:<tag>
```

### Resource Quotas Exceeded

Check namespace quotas:
```bash
kubectl describe resourcequota -n <namespace>
```
```

### Step 6: Create Instructions

Write conventions in `instructions/acme-conventions.md`:

```markdown
# Acme Coding Conventions

Standards and patterns for Acme Corp projects.

## Naming Conventions

### Variables
- Use `camelCase` for JavaScript/TypeScript
- Use `snake_case` for Python
- Use descriptive names, avoid abbreviations

### Functions
- Start with verb: `getUserById`, `calculateTotal`
- Keep functions small (<50 lines)
- Single responsibility

### Files
- Use `kebab-case` for filenames: `user-service.ts`
- One class/export per file

## Code Patterns

### Error Handling

Always use try-catch for async operations:

\`\`\`typescript
try {
  const result = await apiCall();
  return result;
} catch (error) {
  logger.error('API call failed', { error });
  throw new AppError('Failed to fetch data', 500);
}
\`\`\`

### Logging

Use structured logging:

\`\`\`typescript
logger.info('User created', {
  userId: user.id,
  email: user.email,
  timestamp: new Date()
});
\`\`\`

### Database Queries

Use Prisma for database access:

\`\`\`typescript
const user = await prisma.user.findUnique({
  where: { id: userId },
  include: { profile: true }
});
\`\`\`

## Testing Standards

- **Unit tests:** >80% coverage
- **Integration tests:** All API endpoints
- **E2E tests:** Critical user flows

## Security

- Never commit secrets (use environment variables)
- Sanitize user inputs
- Use parameterized queries
- Enable HTTPS only

## Documentation

Every function must have JSDoc:

\`\`\`typescript
/**
 * Fetches user by ID
 * @param userId - Unique user identifier
 * @returns User object or null
 * @throws {NotFoundError} If user doesn't exist
 */
async function getUserById(userId: string): Promise<User | null> {
  // Implementation...
}
\`\`\`
```

### Step 7: Add README

Create `README.md`:

```markdown
# Acme Deployment Pack

Standardized deployment workflows for Acme Corp projects.

## Contents

- **@acme-deployer** agent — Automated deployment to Acme infrastructure
- **deployment-checklist** skill — Step-by-step deployment guide
- **acme-conventions** instructions — Coding standards

## Installation

\`\`\`bash
spectree install @acme/deployment
\`\`\`

## Usage

### Deploy an Application

\`\`\`
@acme-deployer deploy my-app to staging
\`\`\`

### Follow Deployment Checklist

Agents can reference the checklist during deployments.

## Requirements

- @spectree/core@^1.0.0

## Support

Questions? Contact engineering@acme.com
```

### Step 8: Test Locally

Install your pack locally for testing:

```bash
# From pack directory
spectree install .
```

**Verify installation:**

```bash
spectree list
```

Should show `@acme/deployment@1.0.0` installed.

**Test the agent:**

```
@acme-deployer help
```

Should show help text from your agent.

### Step 9: Validate Pack Structure

Use CLI to check for issues:

```bash
spectree validate .
```

**Checks:**
- `pack.json` is valid JSON
- All referenced files exist
- Paths are correct
- Dependencies are resolvable

**Fix any errors before publishing.**

### Step 10: Publish to Registry

Once tested, publish:

```bash
spectree publish .
```

**What happens:**

1. Validates pack structure
2. Checks for naming conflicts
3. Uploads files to registry
4. Registers version in database

**Output:**

```
📦 Publishing @acme/deployment@1.0.0...

Validating...
✅ pack.json is valid
✅ All files exist
✅ No naming conflicts

Uploading...
✅ Uploaded 5 files

Registering...
✅ Registered @acme/deployment@1.0.0

🎉 Successfully published!

Install with:
  spectree install @acme/deployment

View in registry:
  https://spectree.dev/packs/@acme/deployment
```

---

## Advanced: Versioning

### Publishing Updates

After making changes:

1. Increment version in `pack.json`:
   ```json
   "version": "1.1.0"
   ```

2. Document changes in `CHANGELOG.md` (optional but recommended)

3. Publish new version:
   ```bash
   spectree publish .
   ```

### Semantic Versioning

Follow semver rules:

- **Major (1.x.x → 2.0.0):** Breaking changes
- **Minor (1.0.x → 1.1.0):** New features, backward compatible
- **Patch (1.0.0 → 1.0.1):** Bug fixes

### Prerelease Versions

Test before stable release:

```json
"version": "1.1.0-beta.1"
```

---

## Common Pitfalls

### Pack Name Already Taken

**Problem:** `@acme/deployment` exists  
**Solution:** Choose a unique name or namespace

### Broken File Paths

**Problem:** Agent references `agents/deploy.md` but file is `agents/deployer.md`  
**Solution:** Ensure paths in `pack.json` match actual files exactly

### Missing Dependencies

**Problem:** Agent uses SpecTree tools but `@spectree/core` not in dependencies  
**Solution:** Add all required packs to `dependencies`

### Circular Dependencies

**Problem:** Pack A depends on Pack B, Pack B depends on Pack A  
**Solution:** Refactor to remove circular dependency or merge packs

---

## Best Practices

### 1. Clear Documentation

Every agent/skill needs:
- Purpose
- Usage examples
- Prerequisites
- Error handling

### 2. Single Responsibility

Each pack should have a focused purpose. Don't create "kitchen sink" packs.

### 3. Version Carefully

- Test thoroughly before publishing
- Use prerelease versions for testing
- Document breaking changes clearly

### 4. Consistent Naming

Follow conventions:
- Agents: `@org-purpose` (e.g., `@acme-deployer`)
- Skills: `purpose-action` (e.g., `deployment-checklist`)
- Packs: `@org/category` (e.g., `@acme/deployment`)

### 5. Include Examples

Show concrete usage examples in documentation.

---

## Expected Output

After creating and publishing:

✅ Custom pack published to registry  
✅ Pack installable via `spectree install @your-org/pack-name`  
✅ Agents/skills work in GitHub Copilot  
✅ Team can use your custom workflows  

**Time saved:** Hours per week by standardizing team workflows

---

## Next Steps

- **[Updating Skill Packs](./update-packs.md)** — Keep your pack up-to-date
- **[Architecture Overview](../architecture/skill-packs.md)** — Deep dive into pack system design

---

## What You Learned

✅ Planning a custom skill pack  
✅ Creating pack structure (manifest, agents, skills, instructions)  
✅ Testing packs locally  
✅ Publishing to registry  
✅ Versioning and updates  

**Pro Tip:** Start small with one agent or skill. Expand your pack over time as you identify common patterns in your team's workflows.
