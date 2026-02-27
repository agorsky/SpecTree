# ENG-1: Auth Simplification (API Backend)

Replace JWT multi-user auth with dual-auth: passphrase sessions for web UI, API tokens for agents. Remove registration, invitations, and multi-user overhead.

**Working directory:** ~/Projects/SpecTree
**Target stack:** Production local Docker (port 3001), NOT the dev container.
**Verification:** After changes, rebuild prod Docker: `docker-compose -f docker-compose.local.yml up -d --build`

## Context

The production SpecTree instance runs at http://localhost (web) and http://localhost:3001 (API) via docker-compose.local.yml.
There is also a dev Docker instance at ports 3002/3003 — ignore it. Work against the production config only.

The MCP API token for verification: st_j1KJ00Oi95JfxWPC0Ny_nuOSqaXurPMHuvORK4epl-E

## Tasks

- [x] Read and understand the current auth flow: packages/api/src/routes/auth.ts and packages/api/src/middleware/authenticate.ts
- [x] Modify POST /api/v1/auth/login in auth.ts to accept {passphrase: string} body field; validate against process.env.SPECTREE_PASSPHRASE env var; on match call prisma.user.findFirst() to get admin user and return generateAccessToken/generateRefreshToken with same response shape; update loginSchema in schemas/auth.ts to z.object({passphrase: z.string().min(1)})
- [x] Add passphrase session token support to authenticate.ts middleware as a third auth path alongside existing JWT and API token paths
- [x] Simplify authorize.ts (610 lines) to single-user pass-through: keep ALL function signatures identical, remove multi-user scope/role checks so every authenticated user passes through automatically
- [x] Make globalAdmin.ts a no-op pass-through: keep function signature, always return true
- [x] Remove admin route registrations from packages/api/src/index.ts (lines 88-89 or nearby)
- [x] Delete packages/api/src/routes/admin/invitations.ts
- [x] Delete packages/api/src/routes/admin/users.ts (if it exists separately)
- [x] Update packages/api/prisma/seed.ts to work without a real bcrypt password hash (use a fixed hash or skip password entirely)
- [x] Add SPECTREE_PASSPHRASE=devpassphrase123 to docker-compose.local.yml env vars for the API service
- [x] Rebuild production Docker: docker-compose -f docker-compose.local.yml up -d --build
- [x] Verify passphrase login works on port 3001: curl -s -X POST http://localhost:3001/api/v1/auth/login -H "Content-Type: application/json" -d '{"passphrase":"devpassphrase123"}' — confirm accessToken in response
- [x] Verify API token path still works on port 3001: curl -s http://localhost:3001/api/v1/teams -H "Authorization: Bearer st_j1KJ00Oi95JfxWPC0Ny_nuOSqaXurPMHuvORK4epl-E" — confirm teams list returned
- [x] Verify registration endpoint returns 404 on port 3001: curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3001/api/v1/auth/register — confirm 404
- [x] Verify admin invitation routes return 404 on port 3001: curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/v1/admin/invitations — confirm 404
- [x] Commit all changes to git with message: "ENG-1: Auth simplification — passphrase auth + remove multi-user overhead" then run git log --oneline -1 to confirm the commit exists on disk before marking this task done
