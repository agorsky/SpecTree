# GitHub Actions Azure Setup Request

> **Document for Azure Administrator**
>
> This document contains the requirements for setting up Azure authentication for GitHub Actions CI/CD pipeline.

---

## Overview

We need to configure GitHub Actions to deploy the SpecTree application to Azure Container Apps. This requires setting up authentication between GitHub and Azure.

## Target Resources

| Resource | Name | Resource Group |
|----------|------|----------------|
| Container Registry | `acrspectreedev` | `rg-spectree-dev` |
| API Container App | `ca-spectree-api-dev` | `rg-spectree-dev` |
| Web Container App | `ca-spectree-web-dev` | `rg-spectree-dev` |

## GitHub Repository

- **Organization/User**: `<FILL IN YOUR GITHUB ORG/USERNAME>`
- **Repository**: `SpecTree`
- **Branch**: `main`

---

## Option 1: OIDC Federated Credentials (Recommended)

This is the more secure approach - no secrets to manage or rotate.

### Step 1: Create App Registration

1. Go to **Azure Portal → Microsoft Entra ID → App registrations**
2. Click **New registration**
3. Name: `sp-spectree-github`
4. Supported account types: **Single tenant**
5. Click **Register**

### Step 2: Add Federated Credential

1. In the app registration, go to **Certificates & secrets**
2. Click **Federated credentials** tab
3. Click **Add credential**
4. Configure:
   - **Federated credential scenario**: GitHub Actions deploying Azure resources
   - **Organization**: `<github-org-or-username>`
   - **Repository**: `SpecTree`
   - **Entity type**: Branch
   - **GitHub branch name**: `main`
   - **Name**: `github-main-branch`
5. Click **Add**

### Step 3: Grant Role Assignment

1. Go to **Azure Portal → Resource Groups → rg-spectree-dev**
2. Click **Access control (IAM)**
3. Click **Add → Add role assignment**
4. Role: **Contributor**
5. Members: Select the `sp-spectree-github` app registration
6. Click **Review + assign**

### Step 4: Provide These Values

Please send back:

| Value | Where to Find |
|-------|---------------|
| **Application (client) ID** | App registration → Overview |
| **Directory (tenant) ID** | App registration → Overview |
| **Subscription ID** | Subscriptions page or `az account show --query id -o tsv` |

---

## Option 2: Client Secret (Alternative)

If federated credentials aren't preferred, create a service principal with a secret.

### Run This Command

```bash
SUBSCRIPTION_ID=$(az account show --query id -o tsv)

az ad sp create-for-rbac \
  --name "sp-spectree-github" \
  --role contributor \
  --scopes /subscriptions/$SUBSCRIPTION_ID/resourceGroups/rg-spectree-dev \
  --sdk-auth
```

### Provide the Output

Send back the **entire JSON output** from the command above. It will look like:

```json
{
  "clientId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "clientSecret": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "subscriptionId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "tenantId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "activeDirectoryEndpointUrl": "https://login.microsoftonline.com",
  "resourceManagerEndpointUrl": "https://management.azure.com/",
  ...
}
```

---

## Required Permissions Summary

The service principal needs:

| Permission | Scope | Reason |
|------------|-------|--------|
| **Contributor** | `rg-spectree-dev` resource group | Deploy to Container Apps, push to ACR |

---

## Questions?

Contact: `<FILL IN YOUR EMAIL/CONTACT>`

---

## After Setup

Once credentials are provided, the developer will:

1. Add the credentials as GitHub repository secrets
2. Test the CI/CD pipeline by pushing to `main` branch
3. Verify deployments work correctly

No further admin action should be needed after initial setup.
