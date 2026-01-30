# User Registration & Management Options Analysis

> **Strategic analysis for SpecTree user registration without Microsoft Entra**
>
> This document analyzes various approaches to secure user registration and management
> when Microsoft Entra (Azure AD) integration is not immediately available. The goal is
> to find a practical interim solution that provides reasonable security for internal
> company deployment.

---

## Table of Contents

1. [Current State](#current-state)
2. [Requirements & Constraints](#requirements--constraints)
3. [Option Analysis](#option-analysis)
   - [Option 1: Admin-Generated Invite Codes](#option-1-admin-generated-invite-codes-recommended)
   - [Option 2: Email Domain Restriction Only](#option-2-email-domain-restriction-only)
   - [Option 3: Pre-Seeded User Accounts](#option-3-pre-seeded-user-accounts)
   - [Option 4: Shared Registration Secret](#option-4-shared-registration-secret)
   - [Option 5: Manager Approval Workflow](#option-5-manager-approval-workflow)
4. [Recommendation](#recommendation)
5. [Implementation Considerations](#implementation-considerations)
6. [Migration Path to Microsoft Entra](#migration-path-to-microsoft-entra)

---

## Current State

### Existing Authentication System

SpecTree currently has a functional authentication system with:

| Feature | Status | Details |
|---------|--------|---------|
| User accounts | ✅ Implemented | Email, name, bcrypt password hash |
| Login | ✅ Implemented | Email + password with JWT tokens |
| JWT tokens | ✅ Implemented | 15-min access, 7-day refresh |
| API tokens | ✅ Implemented | Long-lived tokens for MCP/API access |
| Team roles | ✅ Implemented | Admin, member, guest (per-team) |
| Registration | ⚠️ Open | `POST /api/v1/users` - no restrictions |

### Security Gap

**The critical issue**: The current `POST /api/v1/users` endpoint is completely public. Anyone who discovers the API can create an account. This is unacceptable for an internal company deployment.

### Database Schema (User Model)

```prisma
model User {
  id           String   @id @default(uuid())
  email        String   @unique
  name         String
  passwordHash String   @map("password_hash")
  avatarUrl    String?  @map("avatar_url")
  isActive     Boolean  @default(true) @map("is_active")
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  
  memberships      Membership[]
  assignedFeatures Feature[]
  assignedTasks    Task[]
  apiTokens        ApiToken[]
  personalScope    PersonalScope?
}
```

---

## Requirements & Constraints

### Must Have

1. **Controlled access**: Not anyone can create an account
2. **No email verification capability**: Cannot send verification emails
3. **Company email domain restriction**: Only `@toro.com` addresses
4. **Admin oversight**: Admins should control who can join
5. **Reasonable security**: Acceptable for internal company use (not public-facing)
6. **Simple UX**: Users shouldn't need complex setup processes

### Nice to Have

1. Easy migration path to Microsoft Entra later
2. Audit trail of who created accounts
3. Ability to revoke access quickly
4. Self-service password reset (if possible without email)

### Constraints

1. **No SMTP/email service** available initially
2. **No Microsoft Entra** until IT department assistance is available
3. **Internal company deployment** (not public internet, Azure-hosted)
4. **Limited initial admin resources** for manual user management

---

## Option Analysis

### Option 1: Admin-Generated Invite Codes (RECOMMENDED)

#### How It Works

1. **Admin creates invitation** via user management screen
   - Enters user's email address (must be `@toro.com`)
   - System generates a unique, time-limited invite code
   - Admin shares code with user out-of-band (Teams, in-person, etc.)

2. **User activates account**
   - Goes to `/register` or `/activate` page
   - Enters email address and invite code
   - If valid, prompts for password creation (entered twice)
   - Account becomes active

3. **Security features**
   - Codes are one-time use
   - Codes expire (configurable: 24-72 hours)
   - Codes are tied to specific email addresses
   - Domain validation (`@toro.com` only)

#### Database Changes Required

```prisma
model UserInvitation {
  id         String    @id @default(uuid())
  email      String    @unique  // Target email
  code       String    @unique  // Random invite code
  createdBy  String    @map("created_by")  // Admin user ID
  expiresAt  DateTime  @map("expires_at")
  usedAt     DateTime? @map("used_at")
  createdAt  DateTime  @default(now())
  
  creator    User      @relation("InvitationCreator", fields: [createdBy], references: [id])
}
```

#### API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/admin/invitations` | POST | Admin | Create invitation |
| `/api/v1/admin/invitations` | GET | Admin | List pending invitations |
| `/api/v1/admin/invitations/:id` | DELETE | Admin | Revoke invitation |
| `/api/v1/auth/activate` | POST | Public | Activate account with code |

#### Pros

- ✅ **Strong control**: Admin explicitly approves each user
- ✅ **Audit trail**: Know who invited whom
- ✅ **No email required**: Out-of-band code sharing (Teams, Slack, in-person)
- ✅ **Time-limited**: Codes expire, reducing window of exposure
- ✅ **One-time use**: Code cannot be reused or shared
- ✅ **Email-bound**: Code only works for the intended email address
- ✅ **Good UX**: Users just need email + code + password

#### Cons

- ❌ **Manual process**: Admin must create each invitation
- ❌ **Out-of-band sharing**: Requires separate communication channel
- ❌ **Admin bottleneck**: All registrations go through admins

#### Security Level: ⭐⭐⭐⭐ (High for interim solution)

---

### Option 2: Email Domain Restriction Only

#### How It Works

1. Modify registration endpoint to only accept `@toro.com` emails
2. Anyone with a valid company email can self-register
3. No additional verification

#### Implementation

```typescript
// In registration endpoint
if (!email.toLowerCase().endsWith('@toro.com')) {
  throw new ValidationError('Only @toro.com email addresses are allowed');
}
```

#### Pros

- ✅ **Simplest implementation**: One validation check
- ✅ **Self-service**: No admin bottleneck
- ✅ **Fast onboarding**: Users register immediately

#### Cons

- ❌ **No verification**: Anyone who *knows* a company email can register
- ❌ **Email guessing**: Attackers could try common name patterns
- ❌ **No audit trail**: No record of who authorized the user
- ❌ **Typo risk**: User could mistype email, create orphan account
- ❌ **Impersonation risk**: Could register as someone else

#### Security Level: ⭐⭐ (Low)

**Verdict**: Too risky. Without email verification, this provides minimal security.

---

### Option 3: Pre-Seeded User Accounts

#### How It Works

1. Admin creates user accounts with temporary passwords
2. Admin shares credentials out-of-band
3. User logs in and must change password on first login

#### Database Changes

```prisma
model User {
  // ... existing fields
  mustChangePassword Boolean @default(false) @map("must_change_password")
}
```

#### Pros

- ✅ **Full admin control**: Admin creates all accounts
- ✅ **Simple user flow**: Just login and change password
- ✅ **No new data models**: Minor schema change

#### Cons

- ❌ **Password handling risk**: Admin knows initial password
- ❌ **More admin work**: Must enter all user details
- ❌ **Credential transmission risk**: Sharing passwords is inherently risky
- ❌ **No user choice in email**: Admin sets everything

#### Security Level: ⭐⭐⭐ (Medium)

**Verdict**: Viable but less secure than invite codes due to password transmission.

---

### Option 4: Shared Registration Secret

#### How It Works

1. A single registration secret is configured (environment variable)
2. Users must provide this secret during registration
3. Secret can be shared internally (wiki, Teams channel)

#### Implementation

```typescript
// Registration endpoint
const { email, name, password, registrationSecret } = request.body;

if (registrationSecret !== process.env.REGISTRATION_SECRET) {
  throw new UnauthorizedError('Invalid registration secret');
}

if (!email.toLowerCase().endsWith('@toro.com')) {
  throw new ValidationError('Only company email addresses allowed');
}
```

#### Pros

- ✅ **Very simple**: One environment variable
- ✅ **Self-service**: Users register themselves
- ✅ **Easy to rotate**: Change env var if leaked

#### Cons

- ❌ **Secret sharing**: Secret may leak or be shared too broadly
- ❌ **No individual accountability**: All users use same secret
- ❌ **No audit trail**: Can't track who shared the secret
- ❌ **Still allows impersonation**: No email verification
- ❌ **Binary access**: Either you know the secret or you don't

#### Security Level: ⭐⭐½ (Low-Medium)

**Verdict**: Better than nothing, but shared secrets tend to leak over time.

---

### Option 5: Manager Approval Workflow

#### How It Works

1. User requests access with email and name
2. Request goes into pending queue
3. Admin reviews and approves/rejects
4. If approved, user receives activation link or code

#### Database Changes

```prisma
model AccessRequest {
  id          String    @id @default(uuid())
  email       String    @unique
  name        String
  status      String    @default("pending") // pending, approved, rejected
  reviewedBy  String?   @map("reviewed_by")
  reviewedAt  DateTime? @map("reviewed_at")
  createdAt   DateTime  @default(now())
}
```

#### Pros

- ✅ **Self-initiated**: Users start the process
- ✅ **Admin approval**: Explicit authorization required
- ✅ **Audit trail**: Record of requests and decisions
- ✅ **Queue visibility**: Admins see pending requests

#### Cons

- ❌ **More complex**: Two-phase process
- ❌ **Still needs activation mechanism**: Combines with Option 1 or 3
- ❌ **Delay**: Users must wait for approval
- ❌ **Admin burden**: Must check queue regularly

#### Security Level: ⭐⭐⭐⭐ (High)

**Verdict**: Good security but adds complexity. Consider as enhancement to Option 1.

---

## Recommendation

### Primary Recommendation: Option 1 - Admin-Generated Invite Codes

**This is the recommended approach** because it provides:

1. **Strong security** without email verification
2. **Clear accountability** (admin creates invitation → user activates)
3. **Reasonable UX** (code + email + password)
4. **Audit trail** (who invited whom, when)
5. **Flexibility** (can revoke pending invitations)

### Implementation Summary

#### New Database Model

```prisma
model UserInvitation {
  id         String    @id @default(uuid())
  email      String    @unique
  code       String    @unique
  createdBy  String    @map("created_by")
  expiresAt  DateTime  @map("expires_at")
  usedAt     DateTime? @map("used_at")
  createdAt  DateTime  @default(now())

  creator    User      @relation("InvitationCreator", fields: [createdBy], references: [id])
}
```

#### New API Endpoints

1. **POST /api/v1/admin/invitations** - Create invitation (admin only)
2. **GET /api/v1/admin/invitations** - List invitations (admin only)
3. **DELETE /api/v1/admin/invitations/:id** - Revoke invitation (admin only)
4. **POST /api/v1/auth/activate** - Activate account with code (public)

#### New UI Components

1. **Admin User Management Page** (`/admin/users`)
   - List all users
   - Create invitation form
   - View pending invitations
   - Revoke invitations
   - Deactivate users

2. **Account Activation Page** (`/activate`)
   - Email input
   - Invite code input
   - Password input (twice for confirmation)
   - Submit to activate

#### Invite Code Specifications

| Property | Recommendation |
|----------|----------------|
| Format | 8 alphanumeric characters (e.g., `A1B2C3D4`) |
| Case | Case-insensitive for user convenience |
| Expiration | 72 hours from creation |
| Usage | Single-use only |
| Generation | Cryptographically secure random |

#### Security Measures

1. **Domain validation**: Only `@toro.com` emails
2. **Code expiration**: 72-hour default
3. **One-time use**: Code invalidated after activation
4. **Rate limiting**: Prevent brute-force attempts on activation endpoint
5. **Audit logging**: Log all invitation and activation events
6. **Admin-only creation**: Require team admin role for invitation management

### Optional Enhancement: Combine with Access Request Queue

For even better UX, consider adding a request queue (Option 5 hybrid):

1. User goes to `/request-access`
2. Enters their `@toro.com` email and name
3. Request appears in admin queue
4. Admin can "approve" which auto-generates invite code
5. Admin shares code with user

This reduces admin data entry while maintaining control.

---

## Implementation Considerations

### Defining "Admin" for User Management

Since SpecTree uses team-scoped roles (not global admin), we need to decide:

**Option A: Global Admin Flag**
```prisma
model User {
  // ... existing fields
  isGlobalAdmin Boolean @default(false) @map("is_global_admin")
}
```

**Option B: Any Team Admin**
- Any user with `admin` role in any team can manage invitations
- Simpler but less controlled

**Option C: Specific "System Admin" Team**
- Create a special team (e.g., "SpecTree Admins")
- Only admins of this team can manage users

**Recommendation**: Option A (Global Admin Flag) is clearest and most controllable.

### Frontend Changes

| Page | Purpose | Access |
|------|---------|--------|
| `/activate` | Account activation | Public |
| `/admin/users` | User management | Global admins |
| `/admin/invitations` | Invitation management | Global admins |

### Disable Open Registration

The current `POST /api/v1/users` public endpoint should be:
- **Modified** to require authentication (admin only), OR
- **Removed** in favor of the invitation flow

### Password Requirements

For the activation password, enforce:
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- No common passwords (optional blocklist)

---

## Migration Path to Microsoft Entra

When IT support becomes available, the migration path is straightforward:

### Phase 1: Add Entra as Additional Auth Method

1. Implement Microsoft Entra OAuth flow alongside existing auth
2. Allow both local accounts and Entra accounts
3. Users can link accounts if they have both

### Phase 2: Encourage Entra Migration

1. Prompt existing users to link Entra accounts
2. New users default to Entra registration
3. Invitation system can offer "Invite to Entra" option

### Phase 3: Deprecate Local Auth (Optional)

1. Disable local registration entirely
2. Existing local accounts continue to work
3. Encourage remaining users to migrate

### What Stays the Same

- User model remains mostly unchanged
- JWT token system still works (Entra provides identity, local JWTs for API)
- Team roles and permissions unchanged
- Feature/task assignments unchanged

### What Changes

- Registration flow replaced by Entra OAuth
- Password storage no longer needed for Entra users
- Password reset handled by Entra

---

## Summary Comparison

| Option | Security | Complexity | UX | Admin Burden | Recommendation |
|--------|----------|------------|-----|--------------|----------------|
| 1. Invite Codes | ⭐⭐⭐⭐ | Medium | Good | Medium | ✅ **RECOMMENDED** |
| 2. Domain Only | ⭐⭐ | Low | Excellent | None | ❌ Too risky |
| 3. Pre-Seeded | ⭐⭐⭐ | Low | Good | High | ⚠️ Acceptable |
| 4. Shared Secret | ⭐⭐½ | Very Low | Good | Low | ❌ Secret leakage |
| 5. Approval Queue | ⭐⭐⭐⭐ | High | Fair | Medium | ⚠️ Enhancement |

---

## Next Steps

1. **Design database schema changes** for UserInvitation model
2. **Implement admin API endpoints** for invitation CRUD
3. **Create activation endpoint** with validation
4. **Build admin UI** for user/invitation management
5. **Build activation UI** for new users
6. **Add global admin flag** to User model
7. **Secure/modify existing registration endpoint**
8. **Add rate limiting** to activation endpoint
9. **Test the full flow** end-to-end
10. **Document the process** for admins and users

---

## Appendix: Invite Code Generation

```typescript
import crypto from 'crypto';

function generateInviteCode(): string {
  // Generate 4 random bytes = 8 hex characters
  const buffer = crypto.randomBytes(4);
  // Convert to uppercase alphanumeric (remove ambiguous chars like 0/O, 1/I/L)
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (const byte of buffer) {
    code += chars[byte % chars.length];
  }
  return code;
}

// Example output: "A3K7NP2M"
```

---

*Document created: January 30, 2026*
*For use with SpecTree Azure deployment planning*
