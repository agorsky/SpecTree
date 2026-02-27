# Authentication & User API Endpoints

This document describes the authentication and user management API endpoints in Dispatcher.

## Overview

Dispatcher uses JWT-based authentication with access and refresh tokens. User accounts are created via invitation code (see [Invitation Endpoints](./invitation-endpoints.md)) and then authenticated via email/password login.

---

## Table of Contents

- [Authentication Endpoints](#authentication-endpoints)
  - [Login](#post-apiv1authlogin)
  - [Refresh Token](#post-apiv1authrefresh)
  - [Logout](#get-apiv1authlogout)
  - [Activate Account](#post-apiv1authactivate)
- [User Endpoints](#user-endpoints)
  - [Get Current User](#get-apiv1usersme)
  - [List Users](#get-apiv1users)
  - [Get User](#get-apiv1usersid)
  - [Update User](#put-apiv1usersid)
  - [Delete User](#delete-apiv1usersid)

---

## Authentication Endpoints

### POST /api/v1/auth/login

Authenticate a user with email and password. Returns access and refresh tokens.

**Request Body:**
```json
{
  "email": "john@toro.com",
  "password": "SecureP@ss123"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `email` | string | Yes | Valid email format |
| `password` | string | Yes | Min 8 chars |

**Success Response (200 OK):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "user-uuid",
    "email": "john@toro.com",
    "name": "John Doe",
    "avatarUrl": null,
    "isActive": true,
    "isGlobalAdmin": false,
    "createdAt": "2024-01-01T10:00:00.000Z",
    "updatedAt": "2024-01-01T10:00:00.000Z"
  }
}
```

**Token Lifetimes:**
- **Access Token:** 15 minutes
- **Refresh Token:** 7 days

**Error Responses:**

| Status | Message | Description |
|--------|---------|-------------|
| 401 Unauthorized | Invalid credentials | Email not found or password incorrect |
| 403 Forbidden | Account is deactivated | User account has been disabled |

**Example Error:**
```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "Invalid credentials"
}
```

---

### POST /api/v1/auth/refresh

Get a new access token using a valid refresh token. Use this when the access token expires (after 15 minutes).

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Success Response (200 OK):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Note:** A new refresh token is also returned. Update your stored refresh token.

**Error Responses:**

| Status | Message | Description |
|--------|---------|-------------|
| 401 Unauthorized | Invalid or expired refresh token | Refresh token is invalid, expired, or revoked |

---

### GET /api/v1/auth/logout

Logout the current user. Invalidates the current session.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Success Response (204 No Content)**

**Note:** After logout, the client should discard stored access and refresh tokens.

---

### POST /api/v1/auth/activate

Activate a new account using an invitation code. See [Invitation Endpoints](./invitation-endpoints.md) for the complete invitation workflow.

**Rate Limit:** 5 requests per 15 minutes per IP address

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
| `email` | string | Yes | Valid email format, must match invitation |
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
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Error Responses:**

| Status | Message | Description |
|--------|---------|-------------|
| 400 Bad Request | Invalid input format / weak password | Input validation failed |
| 400 Bad Request | This invitation has expired | Invitation code is older than 72 hours |
| 400 Bad Request | This invitation has already been used | Code was already redeemed |
| 404 Not Found | Invalid email or code | Email/code combination not found |
| 409 Conflict | Account with this email already exists | User already registered |
| 429 Too Many Requests | Rate limit exceeded | Too many activation attempts |

---

## User Endpoints

### GET /api/v1/users/me

Get the currently authenticated user's profile.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Success Response (200 OK):**
```json
{
  "data": {
    "id": "user-uuid",
    "email": "john@toro.com",
    "name": "John Doe",
    "avatarUrl": "https://gravatar.com/avatar/...",
    "isActive": true,
    "isGlobalAdmin": false,
    "createdAt": "2024-01-01T10:00:00.000Z",
    "updatedAt": "2024-01-01T10:00:00.000Z",
    "teamMemberships": [
      {
        "teamId": "team-uuid",
        "role": "member",
        "team": {
          "id": "team-uuid",
          "name": "Engineering",
          "key": "ENG"
        }
      }
    ]
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token

---

### GET /api/v1/users

List all users with pagination.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Results per page (default: 20, max: 100) |

**Success Response (200 OK):**
```json
{
  "data": [
    {
      "id": "user-uuid-1",
      "email": "john@toro.com",
      "name": "John Doe",
      "avatarUrl": null,
      "isActive": true,
      "isGlobalAdmin": false,
      "createdAt": "2024-01-01T10:00:00.000Z",
      "updatedAt": "2024-01-01T10:00:00.000Z"
    },
    {
      "id": "user-uuid-2",
      "email": "jane@toro.com",
      "name": "Jane Smith",
      "avatarUrl": "https://gravatar.com/avatar/...",
      "isActive": true,
      "isGlobalAdmin": false,
      "createdAt": "2024-01-02T10:00:00.000Z",
      "updatedAt": "2024-01-02T10:00:00.000Z"
    }
  ],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token

---

### GET /api/v1/users/:id

Get a single user by ID.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | User ID |

**Success Response (200 OK):**
```json
{
  "data": {
    "id": "user-uuid",
    "email": "john@toro.com",
    "name": "John Doe",
    "avatarUrl": null,
    "isActive": true,
    "isGlobalAdmin": false,
    "createdAt": "2024-01-01T10:00:00.000Z",
    "updatedAt": "2024-01-01T10:00:00.000Z"
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `404 Not Found` - User not found

---

### PUT /api/v1/users/:id

Update a user's profile. Users can only update their own profile unless they are a global admin.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | User ID |

**Request Body (all fields optional):**
```json
{
  "name": "John Updated",
  "email": "john.updated@toro.com",
  "password": "NewSecureP@ss456",
  "avatarUrl": "https://gravatar.com/avatar/newimage",
  "isActive": true
}
```

**Permission Rules:**
- **Self-update:** Any user can update their own name, email, password, avatarUrl
- **Admin-only:** Only global admins can update `isActive` or other users' profiles

**Success Response (200 OK):**
```json
{
  "data": {
    "id": "user-uuid",
    "email": "john.updated@toro.com",
    "name": "John Updated",
    "avatarUrl": "https://gravatar.com/avatar/newimage",
    "isActive": true,
    "updatedAt": "2024-01-15T11:00:00.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid input (e.g., weak password, invalid email)
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - User not found
- `409 Conflict` - Email already in use by another user

---

### DELETE /api/v1/users/:id

Soft delete a user (sets `isActive = false`). Only global admins can delete users. Users cannot delete themselves.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | User ID |

**Success Response (204 No Content)**

**Error Responses:**
- `400 Bad Request` - Cannot delete yourself
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Not a global admin
- `404 Not Found` - User not found

---

## Personal Scope Endpoints

Personal scope provides a private workspace for users to manage personal projects, features, and tasks.

### GET /api/v1/me/personal-scope

Get the authenticated user's personal scope. Creates one if it doesn't exist (lazy initialization).

**Headers:**
```
Authorization: Bearer <access_token>
```

**Success Response (200 OK):**
```json
{
  "data": {
    "id": "personal-scope-uuid",
    "userId": "user-uuid",
    "createdAt": "2024-01-01T10:00:00.000Z",
    "updatedAt": "2024-01-01T10:00:00.000Z"
  }
}
```

---

### GET /api/v1/me/personal-projects

List personal projects in the user's personal scope.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `cursor` | string | Pagination cursor |
| `limit` | number | Results per page (default: 20, max: 100) |

**Success Response (200 OK):**
```json
{
  "data": [
    {
      "id": "project-uuid",
      "personalScopeId": "personal-scope-uuid",
      "name": "Personal Tasks",
      "description": "My personal task tracking",
      "icon": "📝",
      "color": "#3B82F6",
      "sortOrder": 1000,
      "createdAt": "2024-01-01T10:00:00.000Z",
      "updatedAt": "2024-01-01T10:00:00.000Z"
    }
  ],
  "meta": {
    "hasMore": false,
    "cursor": null
  }
}
```

---

### POST /api/v1/me/personal-projects

Create a new personal project.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Side Project Ideas",
  "description": "Collection of side project ideas",
  "icon": "💡",
  "color": "#F59E0B"
}
```

**Success Response (201 Created):**
```json
{
  "data": {
    "id": "new-project-uuid",
    "personalScopeId": "personal-scope-uuid",
    "name": "Side Project Ideas",
    "description": "Collection of side project ideas",
    "icon": "💡",
    "color": "#F59E0B",
    "sortOrder": 1000,
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  }
}
```

---

### GET /api/v1/me/personal-statuses

List workflow statuses in the user's personal scope.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Success Response (200 OK):**
```json
{
  "data": [
    {
      "id": "status-uuid-1",
      "personalScopeId": "personal-scope-uuid",
      "name": "To Do",
      "category": "unstarted",
      "color": "#94A3B8",
      "position": 0
    },
    {
      "id": "status-uuid-2",
      "personalScopeId": "personal-scope-uuid",
      "name": "In Progress",
      "category": "started",
      "color": "#3B82F6",
      "position": 1
    },
    {
      "id": "status-uuid-3",
      "personalScopeId": "personal-scope-uuid",
      "name": "Done",
      "category": "completed",
      "color": "#10B981",
      "position": 2
    }
  ]
}
```

---

### GET /api/v1/me/work

Get all work items assigned to the current user across all teams.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Success Response (200 OK):**
```json
{
  "data": {
    "features": [
      {
        "id": "feature-uuid",
        "identifier": "ENG-42",
        "title": "User Authentication",
        "statusId": "status-uuid",
        "status": {
          "name": "In Progress",
          "category": "started"
        },
        "epic": {
          "id": "epic-uuid",
          "name": "Q1 2024 Features"
        }
      }
    ],
    "tasks": [
      {
        "id": "task-uuid",
        "identifier": "ENG-42-1",
        "title": "Create OAuth config",
        "statusId": "status-uuid",
        "status": {
          "name": "In Progress",
          "category": "started"
        },
        "feature": {
          "id": "feature-uuid",
          "identifier": "ENG-42",
          "title": "User Authentication"
        }
      }
    ],
    "counts": {
      "totalFeatures": 3,
      "inProgressFeatures": 2,
      "totalTasks": 8,
      "inProgressTasks": 5
    }
  }
}
```

---

### GET /api/v1/me/blocked

Get all blocked items assigned to the current user.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Success Response (200 OK):**
```json
{
  "data": {
    "features": [
      {
        "id": "feature-uuid",
        "identifier": "ENG-43",
        "title": "Payment Integration",
        "blockerReason": "Waiting for API credentials",
        "epic": {
          "name": "Q1 2024 Features"
        }
      }
    ],
    "tasks": [],
    "counts": {
      "totalBlocked": 1
    }
  }
}
```

---

## Authentication Flow Examples

### Initial Authentication
```bash
# 1. Login
curl -X POST https://api.dispatcher.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@toro.com",
    "password": "SecureP@ss123"
  }'

# Response includes accessToken and refreshToken
# Store both securely
```

### Using Access Token
```bash
# 2. Make authenticated request
curl https://api.dispatcher.app/api/v1/features \
  -H "Authorization: Bearer <access_token>"
```

### Refreshing Expired Token
```bash
# 3. When access token expires (after 15 minutes)
curl -X POST https://api.dispatcher.app/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "<refresh_token>"
  }'

# Response includes new accessToken and refreshToken
# Update stored tokens
```

---

## Related Documentation

- [Invitation Endpoints](./invitation-endpoints.md) - Account creation via invitation
- [Team Endpoints](./team-endpoints.md) - Team management
- [Feature Endpoints](./feature-endpoints.md) - Work item management
- [MCP Tools Reference](../MCP/tools-reference.md) - Complete MCP tools reference
