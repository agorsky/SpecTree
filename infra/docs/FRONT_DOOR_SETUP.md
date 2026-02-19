# Azure Front Door & Custom Domain Setup Guide

> **Target Audience:** IT Team / Network Administrators  
> **Last Updated:** February 2026  
> **Status:** Pending IT coordination

## Overview

SpecTree uses Azure Front Door Standard tier as a reverse proxy and WAF (Web Application Firewall) in front of its Container Apps. This document outlines the DNS records required for custom domain configuration.

## Architecture

```
Internet → Azure Front Door (WAF) → Container Apps Environment
                ↓                          ↓
          spectree.toro.com          Internal origins
          spectree-api.toro.com      (Container App FQDNs)
```

## Required DNS Records

### 1. Web Application: `spectree.toro.com`

| Type  | Name                         | Value                                             | Purpose              |
|-------|------------------------------|---------------------------------------------------|----------------------|
| CNAME | `spectree`                   | `ep-spectree-dev.z01.azurefd.net`                | Route traffic to FD  |
| TXT   | `_dnsauth.spectree`          | *(Provided by Azure portal during domain setup)*  | Domain validation    |

### 2. API Endpoint: `spectree-api.toro.com`

| Type  | Name                         | Value                                             | Purpose              |
|-------|------------------------------|---------------------------------------------------|----------------------|
| CNAME | `spectree-api`               | `ep-spectree-dev.z01.azurefd.net`                | Route traffic to FD  |
| TXT   | `_dnsauth.spectree-api`      | *(Provided by Azure portal during domain setup)*  | Domain validation    |

> **Note:** The exact Front Door endpoint hostname (`ep-spectree-dev.z01.azurefd.net`) will be confirmed after initial deployment. The `.z01` segment varies by Azure region.

## TLS / SSL Configuration

- Azure Front Door provides **managed TLS certificates** at no additional cost
- Certificates are auto-provisioned and auto-renewed by Azure
- Minimum TLS version: **1.2**
- No certificate purchase or manual renewal is required

## Steps for IT Team

1. **Create CNAME records** for both `spectree` and `spectree-api` pointing to the Front Door endpoint
2. **Create TXT records** for domain validation (values will be provided by the SpecTree team during Azure Portal configuration)
3. **Confirm propagation** — DNS changes typically propagate within 5-30 minutes
4. **Notify the SpecTree team** once records are live so custom domain and TLS can be finalized in Azure

## Verification

After DNS records are configured, the SpecTree team will:
1. Add custom domains in Azure Front Door portal
2. Trigger domain validation (reads the TXT record)
3. Enable Azure-managed TLS certificates
4. Update Front Door routes to use custom domains
5. Verify end-to-end connectivity

## Timeline

| Step | Owner        | Estimated Duration |
|------|--------------|--------------------|
| DNS record creation | IT Team | 1 business day |
| DNS propagation | Automatic | 5-30 minutes |
| Domain validation + TLS | SpecTree Team | 1-2 hours |
| End-to-end verification | SpecTree Team | 1 hour |

## Contacts

| Role | Name | Notes |
|------|------|-------|
| IT / DNS Admin | Robert Dineen | DNS record creation |
| SpecTree Team | *(Update with deployer name)* | Azure Portal configuration |

## Production Considerations

For production deployment, replace `dev` with `prod` in all endpoint names:
- Front Door endpoint: `ep-spectree-prod.z01.azurefd.net`
- Resource names: `afd-spectree-prod`, `wafpspectreeprod`
- Separate DNS records needed for production custom domains

## Rollback

If issues arise, DNS CNAMEs can be removed to immediately stop routing through Front Door. Container Apps remain directly accessible until Phase 4 lockdown is applied.
