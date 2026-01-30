# Linear Authorization Model

This document describes Linear's team-scoping and authorization model to inform SpecTree's authorization design.

## Overview

Linear implements a hierarchical authorization model with permissions at both the **workspace level** and **team level**. Access control is primarily based on team membership, with special handling for private teams.

## Workspace-Level Roles

Linear defines several workspace-level roles with decreasing permission levels:

### 1. Workspace Owner (Enterprise only)

The highest permission level in Linear with exclusive control over:
- Billing settings
- Security settings (SSO, authentication policies)
- OAuth application management and approvals
- Audit log access
- Workspace exports
- All team access (automatically a team owner for all accessible teams)

### 2. Admin

Elevated permissions for routine workspace operations:
- Manage workspace members
- Change member roles and suspend users
- Access workspace-level administration pages
- Access all non-private teams
- Automatically a team owner for all accessible teams

**Plan-specific behavior:**
- Free plans: All workspace members become admins automatically
- Basic/Business: User upgrading workspace receives admin role
- Enterprise: Admins have more limited permissions compared to Workspace Owners

### 3. Member

Standard access for regular workspace participants:
- Collaborate across teams they have access to
- Use all standard workspace features within assigned teams
- Join/leave public teams independently
- Cannot access workspace-level administration pages
- Cannot change other users' roles

### 4. Guest (Business/Enterprise only)

Restricted access for external collaborators:
- Access only issues, projects, and documents for explicitly assigned teams
- Take the same actions as Members within those teams
- Cannot access workspace-wide features (workspace views, customer requests, initiatives)
- Cannot access settings beyond their own Account tab
- For multi-team projects, guests only see issues from teams they belong to
- Billed as regular members

## Team-Level Roles

### Team Owner (Business/Enterprise only)

Team owners have delegated control over individual team operations:
- Manage team settings (workflow statuses, cycles, triage rules)
- Create and edit team issue labels
- Create and edit team templates
- Manage team membership
- Configure team access restrictions

**Permission delegation:** Team owners can choose whether to allow all members or only team owners to manage:
- Issue labels
- Templates
- Team settings
- Member management (only team owners can add guest users regardless)

**Note:** Workspace admins and owners are automatically team owners for all teams they can access.

### Team Member

Standard team-level access:
- Create and manage issues within the team
- Access team projects and documents
- Participate in team workflows

## Team Visibility and Access

### Public Teams (Default)

- All workspace members can view and join public teams
- Teams appear in the "Exploring" section of sidebar until joined
- Issues and projects are visible to all workspace members
- Team owners can optionally restrict joining to invitation-only

### Private Teams (Business/Enterprise only)

Private teams provide restricted visibility for sensitive work:

**Visibility Rules:**
- Only team members can see issues associated with the private team
- Non-members cannot view private team issues or team details in any context
- Private team name is not visible to non-members
- Members cannot @ mention non-members in private team issues

**Admin Access:**
- Workspace admins can see all private teams in Settings
- Admins receive a warning popup before joining a private team
- Admins can update team settings without being a member

**Leaving/Joining:**
- Members can leave voluntarily but need explicit reinvitation to rejoin
- Non-member assignees are automatically removed when a team becomes private
- All issue subscribers lose subscriptions when visibility changes

## Project-Team Relationship

### Project Scoping

- Projects can belong to a single team or be shared across multiple teams
- **Issues can only belong to one team** (even if project spans multiple teams)
- Sub-issues can be assigned to any team in the workspace

### Cross-Team Project Sharing

**Public to Private Sharing:**
- When a public team shares a project with a private team, only private team members see that association
- Project issues related to the private team are only visible to its members
- If all public team affiliations are removed, the project becomes exclusively private

**Private to Public Sharing:**
- Projects created under private teams are hidden until shared with public teams
- When shared with public teams, the project becomes visible but private team name and its issues remain hidden to non-members

## Integration Access Restrictions

Third-party integrations have restricted access to private team data:

| Integration | Private Team Access |
|-------------|---------------------|
| GitHub/GitLab | ID and link references only |
| Google Sheets | Cannot access private team data |
| Intercom | Cannot create or link private team issues |
| Sentry | Cannot create or link private team issues |
| Zendesk | Cannot create or link private team issues |

## API Authorization

### Authentication Methods

Linear API supports:
1. **Personal API Keys**: `Authorization: <API_KEY>`
2. **OAuth2 Tokens**: `Authorization: Bearer <ACCESS_TOKEN>`

### Rate Limits

| Authentication Type | Rate Limit |
|--------------------|------------|
| Personal API Key | 1,500 requests/hour/user |
| OAuth Application | 500 requests/hour/user/app |
| Unauthenticated | 60 requests/hour/IP |

Linear also implements complexity-based rate limiting for GraphQL queries.

### Error Response Format

Linear follows standard GraphQL error conventions:

```json
{
  "data": null,
  "errors": [
    {
      "message": "Description of what went wrong",
      "path": ["query", "field", "subfield"],
      "extensions": {
        "code": "ERROR_CODE",
        "additionalContext": "..."
      }
    }
  ]
}
```

**Key behaviors:**
- GraphQL queries always return HTTP 200 status (even on errors)
- Partial success is possible: responses can contain both `data` and `errors`
- `errors` array contains all errors that occurred during processing
- Each error includes message, path, and extensions with error codes

### Authentication Errors

| Scenario | Expected Behavior |
|----------|-------------------|
| Missing/invalid token | 401 Unauthorized (pre-GraphQL) |
| Expired access token | 401 Unauthorized (fetch new token if using OAuth) |
| Accessing private team without membership | Empty result or error in `errors` array |
| Rate limit exceeded | 429 Too Many Requests |

**OAuth Token Refresh:**
- Access tokens valid for 24 hours (applications created after Oct 1, 2025)
- Legacy tokens valid for 10 years (no refresh token)
- Server should fetch new token upon receiving 401 error

## SpecTree Simplification

Based on Linear's model, SpecTree simplifies authorization to:

### Entity Model

```
Users belong to Teams via Memberships (with roles)
Projects belong to one Team
Members only see their Teams' Projects
```

### Proposed Roles

| Role | Permissions |
|------|-------------|
| **Owner** | All team permissions + team deletion + member management |
| **Admin** | Manage team settings, labels, templates + standard permissions |
| **Member** | Create/edit/view issues and projects within team |

### Access Rules

1. Users can belong to multiple teams via Memberships
2. Each Membership has a role (Owner, Admin, Member)
3. Projects belong to exactly one Team
4. Issues belong to exactly one Project (and thus one Team)
5. Users can only access Projects in Teams where they have a Membership
6. Team scoping is enforced at the API layer

### API Authorization Pattern

```python
# Pseudocode for SpecTree authorization
def authorize_project_access(user_id, project_id):
    project = get_project(project_id)
    membership = get_membership(user_id, project.team_id)

    if not membership:
        raise ForbiddenError("Not a member of this team")

    return membership.role  # For role-based permission checks
```

## References

- [Linear Members and Roles Documentation](https://linear.app/docs/members-roles)
- [Linear Private Teams Documentation](https://linear.app/docs/private-teams)
- [Linear Teams Documentation](https://linear.app/docs/teams)
- [Linear Security & Access Documentation](https://linear.app/docs/security-and-access)
- [Linear Team Owners Changelog](https://linear.app/changelog/2025-12-17-team-owners)
- [Linear GraphQL API Documentation](https://linear.app/developers/graphql)
- [Linear OAuth 2.0 Authentication](https://linear.app/developers/oauth-2-0-authentication)
