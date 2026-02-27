# User Invitation System

Dispatcher uses an invitation-based registration system to ensure secure user onboarding. Only administrators can create user accounts by generating invitation codes.

## Overview

The invitation system provides:
- **Security**: Only invited users can create accounts
- **Traceability**: All invitations are tracked with creator information
- **Expiration**: Codes automatically expire after 72 hours
- **Domain restriction**: Only `@toro.com` email addresses are allowed

---

## For Administrators

### Creating an Invitation

1. Navigate to **Admin > User Management**
2. Click **Invite User**
3. Enter the user's `@toro.com` email address
4. Copy the generated 8-character invitation code
5. Share the code securely with the user (email, secure message, etc.)

**API Example:**
```bash
curl -X POST https://api.dispatcher.app/api/v1/admin/invitations \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"email": "newuser@toro.com"}'
```

### Invitation States

| State | Description | Can Activate? | Can Revoke? |
|-------|-------------|---------------|-------------|
| **Pending** | Code created, not yet used, not expired | ✅ Yes | ✅ Yes |
| **Used** | User successfully activated their account | ❌ No | ❌ No |
| **Expired** | Code exceeded 72-hour validity period | ❌ No | ✅ Yes |

### Viewing Invitations

List all invitations with optional status filtering:

```bash
# List pending invitations (default)
GET /api/v1/admin/invitations

# List used invitations
GET /api/v1/admin/invitations?status=used

# List expired invitations
GET /api/v1/admin/invitations?status=expired

# List all invitations
GET /api/v1/admin/invitations?status=all
```

### Revoking Invitations

Click the trash icon next to any pending invitation to revoke it, or use the API:

```bash
DELETE /api/v1/admin/invitations/:id
```

**Note:** Revoked invitations cannot be used for activation. You cannot revoke invitations that have already been used.

### Re-inviting Users

If an invitation expires or is revoked, you can create a new invitation for the same email address. The system automatically cleans up the old invitation record.

---

## For New Users

### Receiving Your Invitation

You will receive an 8-character invitation code from an administrator. The code:
- Contains only letters and numbers (no ambiguous characters like 0/O or 1/I/L)
- Is case-insensitive (ABCD1234 = abcd1234)
- Is valid for 72 hours from creation

### Activating Your Account

1. Navigate to the activation page at `/activate`
2. Enter your `@toro.com` email address
3. Enter the 8-character invitation code
4. Choose a display name (minimum 2 characters)
5. Create a password meeting the requirements below
6. Click **Activate Account**

### Password Requirements

Your password must contain:
- At least **8 characters**
- At least **one uppercase letter** (A-Z)
- At least **one lowercase letter** (a-z)
- At least **one number** (0-9)

**Example valid passwords:**
- `SecureP@ss1`
- `MyPassword123`
- `Spectree2024!`

### After Activation

Upon successful activation:
- Your account is immediately active
- You receive access and refresh tokens for API access
- A personal workspace is automatically created for you
- You can log in using your email and password

---

## Troubleshooting

### "Invalid or expired code"

**Possible causes:**
- The invitation code has expired (codes are valid for 72 hours)
- The code was typed incorrectly
- The code has been revoked by an administrator
- You're using a different email than the one invited

**Solution:** Contact your administrator to request a new invitation code.

### "Email already registered"

**Cause:** An account with this email address already exists.

**Solution:** 
- Try logging in with your existing credentials
- Contact an administrator for password reset assistance

### "Pending invitation already exists"

**Cause:** An active (non-expired) invitation already exists for this email.

**Solution:**
- Use the existing invitation code
- Wait for it to expire (72 hours)
- Ask an administrator to revoke the existing invitation

### "Email must end with @toro.com"

**Cause:** Only `@toro.com` email addresses are allowed for registration.

**Solution:** Use your organization's `@toro.com` email address.

### "Password does not meet requirements"

**Cause:** Your password doesn't meet the complexity requirements.

**Solution:** Ensure your password has:
- At least 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number

---

## Security Considerations

### For Administrators

- Share invitation codes through secure channels only
- Monitor pending invitations regularly
- Revoke invitations that are no longer needed
- Review the invitation creator for audit purposes

### For Users

- Activate your account promptly (within 72 hours)
- Choose a strong, unique password
- Do not share your invitation code with others
- Contact your administrator if you suspect code compromise
