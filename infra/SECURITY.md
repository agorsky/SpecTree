# Infrastructure Security Notice

## ⚠️ CRITICAL: Credential Management

### `.env.azure` File

The `infra/.env.azure` file contains **real Azure credentials and SQL passwords**. This file is used for manual deployment and infrastructure testing.

**Security Requirements:**

1. ✅ **Never commit this file** - It is listed in `.gitignore` and must remain ignored
2. ✅ **Verify before commits** - Always run `git status` before committing to ensure no sensitive files are staged
3. ✅ **Rotate credentials if exposed** - If this file is accidentally committed, immediately:
   - Change all SQL passwords in Azure Portal
   - Rotate any API keys or secrets
   - Update Key Vault with new credentials
   - Revoke any exposed service principal credentials
4. ✅ **Use strong passwords** - Credentials should be 20+ characters with mixed case, numbers, and symbols
5. ✅ **Different credentials per environment** - Never reuse credentials between dev/staging/prod

### What's in `.env.azure`?

```bash
SQL_ADMIN_LOGIN=sqladmin              # SQL Server admin username
SQL_ADMIN_PASSWORD=<password>         # SQL Server admin password (SENSITIVE)
SQL_APP_USER_LOGIN=spectree_app       # Application database user
SQL_APP_USER_PASSWORD=<password>      # Application user password (SENSITIVE)
AZURE_AD_OBJECT_ID=<guid>             # Azure AD admin object ID
AZURE_AD_EMAIL=<email>                # Azure AD admin email
```

### Deployment Workflow (Using `.env.azure`)

For manual deployments:

```bash
# Load credentials from .env.azure
source infra/.env.azure

# Use in deployment script
./infra/deploy.sh dev
```

### Automated Deployment (GitHub Actions)

CI/CD pipelines should **NOT** use `.env.azure`. Instead, use GitHub Secrets:

- `AZURE_CLIENT_ID` - Service principal client ID (OIDC)
- `AZURE_TENANT_ID` - Azure tenant ID
- `AZURE_SUBSCRIPTION_ID` - Azure subscription ID

See [docs/github-actions-azure-setup.md](../docs/github-actions-azure-setup.md) for OIDC setup.

### Credential Storage Best Practices

1. **Azure Key Vault** - All runtime secrets (JWT_SECRET, DATABASE_URL) should be stored in Key Vault
2. **Container App Secrets** - Database connection strings use Container App secret reference pattern
3. **Bicep Secure Parameters** - All sensitive parameters use `@secure()` decorator
4. **No secrets in code** - Never hardcode credentials in source code or configuration files

### Audit Commands

```bash
# Verify .env.azure is not tracked by git
git ls-files infra/.env.azure
# Expected: (no output)

# Check if file was ever committed
git log --all --full-history -- infra/.env.azure
# Expected: (no output)

# Search for potential credential leaks in tracked files
git grep -E "password|secret|key" -- '*.md' '*.bicep' '*.yml'
# Expected: Only references to placeholder/documentation
```

### If Credentials Are Compromised

1. **Immediately rotate** all affected credentials
2. **Review Azure audit logs** for unauthorized access
3. **Update Key Vault** with new credentials
4. **Redeploy** container apps with updated connection strings
5. **Notify security team** if data access occurred

### Related Documentation

- [Azure Deployment Guide](../docs/azure-deployment-guide.md) - Secure deployment patterns
- [Bicep Secret Reference Pattern](../docs/bicep-security-reference-pattern.md) - How secrets are handled in infrastructure
- [Secrets Provider](../docs/secrets-provider.md) - Runtime secret management
- [Secure Database Connection Evaluation](../docs/secure-database-connection-evaluation.md) - Security architecture decisions

---

## Git Safety Check

Before every commit:

```bash
# Check for sensitive files
git status

# Ensure .gitignore is working
git check-ignore infra/.env.azure
# Expected: infra/.env.azure
```

If `git status` shows `infra/.env.azure` as a new file, **STOP** and run:

```bash
# Verify .gitignore includes the pattern
grep "infra/.env.azure" .gitignore

# If missing, add it
echo "infra/.env.azure" >> .gitignore
```

---

## Summary

- ✅ `.env.azure` is properly ignored and NOT tracked by git
- ✅ Contains real credentials for manual deployment only
- ✅ Never commit - always verify with `git status`
- ✅ Use GitHub Secrets for CI/CD automation
- ✅ Rotate immediately if exposed
