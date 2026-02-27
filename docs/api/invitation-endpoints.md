# Invitation API Endpoints

This document describes the API endpoints for the user invitation system.

## Authentication

### Admin Endpoints
All admin endpoints (`/api/v1/admin/invitations/*`) require:
- Valid JWT access token in the `Authorization` header
- User must have `isGlobalAdmin: true`

### Public Endpoints
The activation endpoint (`/api/v1/auth/activate`) is public but rate-limited.

---

## Admin Endpoints

### POST /api/v1/admin/invitations

Create a new invitation.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "newuser@toro.com"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | Must be a valid email ending with `@toro.com` |

**Success Response (201 Created):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "newuser@toro.com",
    "code": "ABCD1234",
    "createdBy": "admin-uuid",
    "expiresAt": "2024-01-04T12:00:00.000Z",
    "usedAt": null,
    "createdAt": "2024-01-01T12:00:00.000Z",
    "creator": {
      "id": "admin-uuid",
      "name": "Admin User",
      "email": "admin@toro.com"
    }
  }
}
```

**Error Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 400 | VALIDATION_ERROR | Invalid email format or non-@toro.com domain |
| 401 | UNAUTHORIZED | Missing or invalid authentication token |
| 403 | FORBIDDEN | User is not a global admin |
| 409 | CONFLICT | User already exists OR pending invitation exists |

**Example Error (409):**
```json
{
  "statusCode": 409,
  "code": "CONFLICT",
  "message": "Pending invitation already exists for this email"
}
```

---

### GET /api/v1/admin/invitations

List invitations with optional filtering and pagination.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | `pending` | Filter: `pending`, `used`, `expired`, or `all` |
| `limit` | number | 20 | Results per page (max: 100) |
| `cursor` | string | - | Pagination cursor from previous response |

**Success Response (200 OK):**
```json
{
  "invitations": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user1@toro.com",
      "code": "ABCD1234",
      "createdBy": "admin-uuid",
      "expiresAt": "2024-01-04T12:00:00.000Z",
      "usedAt": null,
      "createdAt": "2024-01-01T12:00:00.000Z",
      "creator": {
        "id": "admin-uuid",
        "name": "Admin User",
        "email": "admin@toro.com"
      }
    }
  ],
  "meta": {
    "hasMore": true,
    "cursor": "next-cursor-id"
  }
}
```

**Status Filter Behavior:**

| Status | Returns |
|--------|---------|
| `pending` | Not used AND not expired |
| `used` | Has `usedAt` timestamp |
| `expired` | Not used AND `expiresAt` < now |
| `all` | All invitations regardless of state |

---

### GET /api/v1/admin/invitations/:id

Get a specific invitation by ID.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Invitation ID |

**Success Response (200 OK):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@toro.com",
    "code": "ABCD1234",
    "createdBy": "admin-uuid",
    "expiresAt": "2024-01-04T12:00:00.000Z",
    "usedAt": null,
    "createdAt": "2024-01-01T12:00:00.000Z",
    "creator": {
      "id": "admin-uuid",
      "name": "Admin User",
      "email": "admin@toro.com"
    }
  }
}
```

**Error Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 401 | UNAUTHORIZED | Missing or invalid authentication token |
| 403 | FORBIDDEN | User is not a global admin |
| 404 | NOT_FOUND | Invitation with specified ID not found |

---

### DELETE /api/v1/admin/invitations/:id

Revoke (delete) a pending invitation. Cannot delete used invitations.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Invitation ID |

**Success Response (204 No Content):**
Empty response body.

**Error Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 400 | VALIDATION_ERROR | Cannot revoke used invitation |
| 401 | UNAUTHORIZED | Missing or invalid authentication token |
| 403 | FORBIDDEN | User is not a global admin |
| 404 | NOT_FOUND | Invitation not found |

---

## Public Endpoints

### POST /api/v1/auth/activate

Activate an account using an invitation code.

**Rate Limit:** 5 requests per 15 minutes per IP address.

**Request Body:**
```json
{
  "email": "newuser@toro.com",
  "code": "ABCD1234",
  "name": "New User",
  "password": "SecureP@ss123"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `email` | string | Yes | Valid email format |
| `code` | string | Yes | Exactly 8 alphanumeric characters |
| `name` | string | Yes | Minimum 2 characters |
| `password` | string | Yes | Min 8 chars, 1 uppercase, 1 lowercase, 1 number |

**Success Response (201 Created):**
```json
{
  "user": {
    "id": "new-user-uuid",
    "email": "newuser@toro.com",
    "name": "New User",
    "avatarUrl": null,
    "isActive": true,
    "createdAt": "2024-01-01T12:00:00.000Z",
    "updatedAt": "2024-01-01T12:00:00.000Z"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**Error Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 400 | VALIDATION_ERROR | Invalid input format, weak password, code expired, or code already used |
| 404 | NOT_FOUND | Invalid email/code combination |
| 409 | CONFLICT | Account with this email already exists |
| 429 | TOO_MANY_REQUESTS | Rate limit exceeded |

**Example Errors:**

*Expired code (400):*
```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "This invitation has expired"
}
```

*Already used (400):*
```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "This invitation has already been used"
}
```

*Invalid combination (404):*
```json
{
  "statusCode": 404,
  "code": "NOT_FOUND",
  "message": "Invalid email or code"
}
```

---

## Invitation Code Format

Invitation codes are:
- **8 characters long**
- **Alphanumeric** using unambiguous characters only
- **Case-insensitive** (accepted as uppercase or lowercase)

**Character Set:**
```
ABCDEFGHJKMNPQRSTUVWXYZ23456789
```

Excluded characters (to prevent confusion):
- `0` and `O` (zero vs letter O)
- `1`, `I`, and `L` (one vs letter I vs letter L)

---

## Workflow Example

### Complete Invitation Flow

```bash
# 1. Admin creates invitation
curl -X POST https://api.dispatcher.app/api/v1/admin/invitations \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"email": "newuser@toro.com"}'

# Response includes code: "ABCD1234"

# 2. Admin shares code with user out-of-band

# 3. User activates account
curl -X POST https://api.dispatcher.app/api/v1/auth/activate \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@toro.com",
    "code": "ABCD1234",
    "name": "New User",
    "password": "SecureP@ss123"
  }'

# Response includes user data and JWT tokens

# 4. Admin can verify invitation was used
curl -X GET "https://api.dispatcher.app/api/v1/admin/invitations?status=used" \
  -H "Authorization: Bearer <admin_token>"
```

---

## Data Model

### UserInvitation

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `email` | string | Unique, lowercase email address |
| `code` | string | Unique 8-character invitation code |
| `createdBy` | UUID | Foreign key to User (admin who created) |
| `expiresAt` | DateTime | Expiration timestamp (72 hours from creation) |
| `usedAt` | DateTime? | Timestamp when account was activated (null if unused) |
| `createdAt` | DateTime | Record creation timestamp |

### Relationships

- `creator` → User (admin who created the invitation)
