# ENG-75: Smoke Test Report

**Date:** 2026-02-27
**Branch:** `feat/eng-75-80-pre-release-hardening`
**Tester:** Bobby (The Builder)

---

## ENG-75-1: Clean Checkout Docker Build

### Initial Findings (FAIL)

All 5 Dockerfiles contained stale package name references (`@spectree/` instead of `@dispatcher/`):

| File | Stale Reference | Fix Applied |
|------|----------------|-------------|
| `packages/api/Dockerfile.local` | `@spectree/shared` | `@dispatcher/shared` |
| `packages/api/Dockerfile` | `@spectree/api`, `@spectree/shared` | `@dispatcher/api`, `@dispatcher/shared` |
| `packages/api/Dockerfile.azure` | `@spectree/shared` | `@dispatcher/shared` |
| `packages/web/Dockerfile` | `@spectree/shared`, `@spectree/web` | `@dispatcher/shared`, `@dispatcher/web` |
| `packages/web/Dockerfile.azure` | `@spectree/shared`, `@spectree/web` | `@dispatcher/shared`, `@dispatcher/web` |

**Root Cause:** Package names were renamed from `@spectree/*` to `@dispatcher/*` but Dockerfiles were not updated.

### Web Build TypeScript Errors (FAIL)

Three TypeScript errors in `packages/web/src/components/crew/`:

| File | Error | Fix |
|------|-------|-----|
| `CrewActivityTimeline.tsx:101` | `Type 'unknown' not assignable to 'ReactNode'` | Changed `meta?.message &&` to `meta?.message != null &&` |
| `EpicBurndownPanel.tsx:5` | `'PhaseIndicator' declared but never read` | Removed unused import |
| `LiveSessionsPanel.tsx:1` | `'useState' declared but never read` | Removed unused import |

### After Fix (PASS)

- API Docker image: **builds successfully**
- Web Docker image: **builds successfully**
- Both images built from clean checkout clone in `/tmp/`

---

## ENG-75-2: Service Startup & Seed Verification

### Health Check: PASS
```
GET /health → 200 {"status":"ok","timestamp":"2026-02-28T05:46:42.015Z"}
```

### API Endpoints: PASS
```
GET /api/v1/teams → 200 (1 team returned)
GET /api/v1/epics → 200 (10 epics returned)
```

### Seed Data: VERIFIED
- Teams: 1 (Engineering)
- Epics: 10
- Health endpoint: operational

---

## ENG-75-3: Web UI Verification

### App Shell: PASS
```
GET / → 200 (HTML with <title>SpecTree</title>, React app shell with #root div)
```

### Route Verification: PASS
```
GET /crew → 200
GET /compliance → 200
```

### Assets: PASS
- JavaScript bundle: `/assets/index-B_oe9fCR.js`
- CSS bundle: `/assets/index-CKfjCWM6.css`

---

## Summary

| Test | Result | Notes |
|------|--------|-------|
| Docker build (API) | PASS (after fix) | Stale `@spectree/` refs fixed |
| Docker build (Web) | PASS (after fix) | TS errors + stale refs fixed |
| Health endpoint | PASS | Returns 200 |
| /api/v1/teams | PASS | Returns seeded data |
| /api/v1/epics | PASS | Returns 10 epics |
| Web UI shell | PASS | React app loads |
| /crew route | PASS | Returns 200 |
| /compliance route | PASS | Returns 200 |

**Overall: PASS** (5 bugs found and fixed)
