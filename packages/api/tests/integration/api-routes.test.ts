/**
 * ENG-79: API Route Integration Tests
 *
 * Tests REAL HTTP requests against localhost:3001 using the auth token.
 * Covers valid payloads (200/201), invalid payloads (400), and
 * nonexistent UUIDs (404) across key domains.
 *
 * Route file count: 26 files, ~150+ routes total
 * Test focus: health, version, teams, epics, features, tasks, statuses,
 *             laws, cases, agent-scores, users, patterns, templates,
 *             decisions, epic-requests, sessions, settings, me, tokens
 */
import { describe, it, expect, beforeAll } from 'vitest';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const API = 'http://localhost:3001';
const AUTH = 'Bearer st_wShsQaYUgKEL9uJosNtLlLx2bqQe0t5tVCN9DxYWIVA';
const headers = { Authorization: AUTH, 'Content-Type': 'application/json' };
/** Headers for requests that carry no JSON body (avoids Fastify's empty-body rejection) */
const authOnly = { Authorization: AUTH };
const ts = () => Date.now(); // timestamp for unique names

const FAKE_UUID = '00000000-0000-0000-0000-000000000000';

// ---------------------------------------------------------------------------
// Shared state populated by earlier tests for use in later ones
// ---------------------------------------------------------------------------
let TEAM_ID: string;
let EPIC_ID: string;
let FEATURE_ID: string;
let TASK_ID: string;
let STATUS_ID: string;
let LAW_ID: string;
let CASE_ID: string;

// ===========================================================================
// 1. Health & Version (no auth required for health; version needs none too)
// ===========================================================================
describe('Health & Version', () => {
  it('GET /health returns 200 with status ok', async () => {
    const res = await fetch(`${API}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('status', 'ok');
  });

  it('GET /health/db returns 200', async () => {
    const res = await fetch(`${API}/health/db`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('status', 'ok');
  });

  it('GET /api/v1/version returns 200 with version and timestamp', async () => {
    const res = await fetch(`${API}/api/v1/version`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('version');
    expect(body).toHaveProperty('timestamp');
  });
});

// ===========================================================================
// 2. Authentication guard
// ===========================================================================
describe('Authentication', () => {
  it('GET /api/v1/teams without auth returns 401', async () => {
    const res = await fetch(`${API}/api/v1/teams`);
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/teams with invalid token returns 401', async () => {
    const res = await fetch(`${API}/api/v1/teams`, {
      headers: { Authorization: 'Bearer invalid_token_12345' },
    });
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/auth/me returns current user', async () => {
    const res = await fetch(`${API}/api/v1/auth/me`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('id');
    expect(body).toHaveProperty('email');
  });
});

// ===========================================================================
// 3. Teams
// ===========================================================================
describe('Teams', () => {
  // --- Valid payloads ---
  it('GET /api/v1/teams returns 200 with data array', async () => {
    const res = await fetch(`${API}/api/v1/teams`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
    // Capture first team for later use
    if (body.data.length > 0) {
      TEAM_ID = body.data[0].id;
    }
  });

  it('POST /api/v1/teams creates a new team', async () => {
    // Key must be uppercase letters only (2-10 chars), generate random
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const key = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * 26)]).join('');
    const res = await fetch(`${API}/api/v1/teams`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: `IntTest Team ${ts()}`,
        key,
        description: 'Integration test team',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data).toHaveProperty('id');
    expect(body.data).toHaveProperty('name');
  });

  it('GET /api/v1/teams/:id returns 200 for existing team', async () => {
    expect(TEAM_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/teams/${TEAM_ID}`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveProperty('id', TEAM_ID);
  });

  it('PUT /api/v1/teams/:id updates a team', async () => {
    expect(TEAM_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/teams/${TEAM_ID}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ description: `Updated at ${new Date().toISOString()}` }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.description).toContain('Updated at');
  });

  // --- Invalid payloads ---
  it('POST /api/v1/teams with missing name returns 400', async () => {
    const res = await fetch(`${API}/api/v1/teams`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ key: 'NONAME' }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/v1/teams with missing key returns 400', async () => {
    const res = await fetch(`${API}/api/v1/teams`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'No Key Team' }),
    });
    expect(res.status).toBe(400);
  });

  // --- Nonexistent UUID ---
  it('GET /api/v1/teams/:id with nonexistent UUID returns 404', async () => {
    const res = await fetch(`${API}/api/v1/teams/${FAKE_UUID}`, { headers });
    expect(res.status).toBe(404);
  });
});

// ===========================================================================
// 4. Statuses
// ===========================================================================
describe('Statuses', () => {
  it('GET /api/v1/statuses returns 200 with data array', async () => {
    const res = await fetch(`${API}/api/v1/statuses`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
    // Find a team-scoped status for later use
    const teamStatus = body.data.find((s: { teamId: string | null }) => s.teamId === TEAM_ID);
    if (teamStatus) {
      STATUS_ID = teamStatus.id;
    }
  });

  it('POST /api/v1/statuses creates a new status', async () => {
    expect(TEAM_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/statuses`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: `Test Status ${ts()}`,
        teamId: TEAM_ID,
        category: 'unstarted',
        color: '#ff0000',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data).toHaveProperty('id');
    expect(body.data).toHaveProperty('name');
    expect(body.data).toHaveProperty('category', 'unstarted');
  });

  it('GET /api/v1/statuses/:id returns 200 for existing status', async () => {
    expect(STATUS_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/statuses/${STATUS_ID}`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveProperty('id', STATUS_ID);
  });

  it('PUT /api/v1/statuses/:id updates a status', async () => {
    expect(STATUS_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/statuses/${STATUS_ID}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ color: '#00ff00' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveProperty('color', '#00ff00');
  });

  // --- Invalid payloads ---
  it('POST /api/v1/statuses with missing name returns 400', async () => {
    const res = await fetch(`${API}/api/v1/statuses`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ teamId: TEAM_ID, category: 'backlog' }),
    });
    // Missing required 'name' field
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('POST /api/v1/statuses with missing teamId returns 400', async () => {
    const res = await fetch(`${API}/api/v1/statuses`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Orphan Status', category: 'backlog' }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  // --- Nonexistent UUID ---
  it('GET /api/v1/statuses/:id with nonexistent UUID returns 404', async () => {
    const res = await fetch(`${API}/api/v1/statuses/${FAKE_UUID}`, { headers });
    expect(res.status).toBe(404);
  });
});

// ===========================================================================
// 5. Epics
// ===========================================================================
describe('Epics', () => {
  it('GET /api/v1/epics returns 200 with data array', async () => {
    const res = await fetch(`${API}/api/v1/epics`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
    // Capture first epic
    if (body.data.length > 0) {
      EPIC_ID = body.data[0].id;
    }
  });

  it('POST /api/v1/epics creates a new epic', async () => {
    expect(TEAM_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/epics`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: `Integration Test Epic ${ts()}`,
        teamId: TEAM_ID,
        description: 'Created by ENG-79 integration tests',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data).toHaveProperty('id');
    expect(body.data).toHaveProperty('name');
    // Use this newly created epic for subsequent tests
    EPIC_ID = body.data.id;
  });

  it('GET /api/v1/epics/:id returns 200 for existing epic', async () => {
    expect(EPIC_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/epics/${EPIC_ID}`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveProperty('id', EPIC_ID);
  });

  it('PUT /api/v1/epics/:id updates an epic', async () => {
    expect(EPIC_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/epics/${EPIC_ID}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        description: `Updated by integration test at ${new Date().toISOString()}`,
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.description).toContain('Updated by integration test');
  });

  it('GET /api/v1/epics/:id/progress-summary returns 200', async () => {
    expect(EPIC_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/epics/${EPIC_ID}/progress-summary`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
  });

  it('GET /api/v1/epics/:id/ai-context returns 200', async () => {
    expect(EPIC_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/epics/${EPIC_ID}/ai-context`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
  });

  it('GET /api/v1/epics/:id/structured-desc returns 200', async () => {
    expect(EPIC_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/epics/${EPIC_ID}/structured-desc`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
  });

  // --- Invalid payloads ---
  it('POST /api/v1/epics with missing name returns 400', async () => {
    const res = await fetch(`${API}/api/v1/epics`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ teamId: TEAM_ID }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('POST /api/v1/epics with missing teamId returns 400', async () => {
    const res = await fetch(`${API}/api/v1/epics`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'No team epic' }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  // --- Nonexistent UUID ---
  it('GET /api/v1/epics/:id with nonexistent UUID returns 404', async () => {
    const res = await fetch(`${API}/api/v1/epics/${FAKE_UUID}`, { headers });
    expect(res.status).toBe(404);
  });

  // --- Archive/Unarchive ---
  it('POST /api/v1/epics/:id/archive then unarchive works', async () => {
    expect(EPIC_ID).toBeDefined();
    const archiveRes = await fetch(`${API}/api/v1/epics/${EPIC_ID}/archive`, {
      method: 'POST',
      headers: authOnly,
    });
    expect(archiveRes.status).toBe(200);
    const archiveBody = await archiveRes.json();
    expect(archiveBody.data.isArchived).toBe(true);

    const unarchiveRes = await fetch(`${API}/api/v1/epics/${EPIC_ID}/unarchive`, {
      method: 'POST',
      headers: authOnly,
    });
    expect(unarchiveRes.status).toBe(200);
    const unarchiveBody = await unarchiveRes.json();
    expect(unarchiveBody.data.isArchived).toBe(false);
  });
});

// ===========================================================================
// 6. Features
// ===========================================================================
describe('Features', () => {
  it('GET /api/v1/features returns 200 with data array', async () => {
    const res = await fetch(`${API}/api/v1/features`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('POST /api/v1/features creates a new feature', async () => {
    expect(EPIC_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/features`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: `IntTest Feature ${ts()}`,
        epicId: EPIC_ID,
        description: 'Created by ENG-79 integration tests',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data).toHaveProperty('id');
    expect(body.data).toHaveProperty('title');
    expect(body.data).toHaveProperty('identifier');
    FEATURE_ID = body.data.id;
  });

  it('GET /api/v1/features/:id returns 200 for existing feature', async () => {
    expect(FEATURE_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/features/${FEATURE_ID}`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveProperty('id', FEATURE_ID);
    expect(body.data).toHaveProperty('title');
  });

  it('PUT /api/v1/features/:id updates a feature', async () => {
    expect(FEATURE_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/features/${FEATURE_ID}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        description: `Updated by integration test at ${new Date().toISOString()}`,
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.description).toContain('Updated by integration test');
  });

  it('GET /api/v1/features/:id/ai-context returns 200', async () => {
    expect(FEATURE_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/features/${FEATURE_ID}/ai-context`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
  });

  it('GET /api/v1/features/:id/structured-desc returns 200', async () => {
    expect(FEATURE_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/features/${FEATURE_ID}/structured-desc`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
  });

  it('GET /api/v1/features/:id/code-context returns 200', async () => {
    expect(FEATURE_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/features/${FEATURE_ID}/code-context`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
  });

  it('GET /api/v1/features/:id/changelog returns 200', async () => {
    expect(FEATURE_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/features/${FEATURE_ID}/changelog`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
  });

  // --- Invalid payloads ---
  it('POST /api/v1/features with missing title returns 400', async () => {
    const res = await fetch(`${API}/api/v1/features`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ epicId: EPIC_ID }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('POST /api/v1/features with missing epicId returns 400', async () => {
    const res = await fetch(`${API}/api/v1/features`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: 'No Epic Feature' }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('POST /api/v1/features with nonexistent epicId returns 404', async () => {
    const res = await fetch(`${API}/api/v1/features`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: 'Ghost Epic Feature', epicId: FAKE_UUID }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  // --- Nonexistent UUID ---
  it('GET /api/v1/features/:id with nonexistent UUID returns 404', async () => {
    const res = await fetch(`${API}/api/v1/features/${FAKE_UUID}`, { headers });
    expect(res.status).toBe(404);
  });
});

// ===========================================================================
// 7. Tasks
// ===========================================================================
describe('Tasks', () => {
  it('GET /api/v1/tasks returns 200 with data array', async () => {
    const res = await fetch(`${API}/api/v1/tasks`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('POST /api/v1/tasks creates a new task', async () => {
    expect(FEATURE_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: `IntTest Task ${ts()}`,
        featureId: FEATURE_ID,
        description: 'Created by ENG-79 integration tests',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data).toHaveProperty('id');
    expect(body.data).toHaveProperty('title');
    expect(body.data).toHaveProperty('identifier');
    TASK_ID = body.data.id;
  });

  it('GET /api/v1/tasks/:id returns 200 for existing task', async () => {
    expect(TASK_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/tasks/${TASK_ID}`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveProperty('id', TASK_ID);
    expect(body.data).toHaveProperty('title');
  });

  it('PUT /api/v1/tasks/:id updates a task', async () => {
    expect(TASK_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/tasks/${TASK_ID}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        description: `Updated by integration test at ${new Date().toISOString()}`,
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.description).toContain('Updated by integration test');
  });

  it('GET /api/v1/tasks/:id/ai-context returns 200', async () => {
    expect(TASK_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/tasks/${TASK_ID}/ai-context`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
  });

  it('GET /api/v1/tasks/:id/structured-desc returns 200', async () => {
    expect(TASK_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/tasks/${TASK_ID}/structured-desc`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
  });

  it('GET /api/v1/tasks/:id/code-context returns 200', async () => {
    expect(TASK_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/tasks/${TASK_ID}/code-context`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
  });

  it('GET /api/v1/tasks/:id/changelog returns 200', async () => {
    expect(TASK_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/tasks/${TASK_ID}/changelog`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
  });

  it('GET /api/v1/tasks/:id/validations returns 200', async () => {
    expect(TASK_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/tasks/${TASK_ID}/validations`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
  });

  // --- Invalid payloads ---
  it('POST /api/v1/tasks with missing title returns 400', async () => {
    const res = await fetch(`${API}/api/v1/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ featureId: FEATURE_ID }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('POST /api/v1/tasks with missing featureId returns 400', async () => {
    const res = await fetch(`${API}/api/v1/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: 'No Feature Task' }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('POST /api/v1/tasks with nonexistent featureId returns 404', async () => {
    const res = await fetch(`${API}/api/v1/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: 'Ghost Feature Task', featureId: FAKE_UUID }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  // --- Nonexistent UUID ---
  it('GET /api/v1/tasks/:id with nonexistent UUID returns 404', async () => {
    const res = await fetch(`${API}/api/v1/tasks/${FAKE_UUID}`, { headers });
    expect(res.status).toBe(404);
  });
});

// ===========================================================================
// 8. Laws
// ===========================================================================
describe('Laws', () => {
  it('GET /api/v1/laws returns 200 with data array', async () => {
    const res = await fetch(`${API}/api/v1/laws`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('POST /api/v1/laws creates a new law', async () => {
    const code = `LAW-${ts() % 100000}`;
    const res = await fetch(`${API}/api/v1/laws`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        lawCode: code,
        title: `Integration Test Law ${ts()}`,
        description: 'A law created by integration tests',
        severity: 'minor',
        auditLogic: 'Check that integration tests pass',
        consequence: 'Test failure logged',
        appliesTo: 'all-agents',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data).toHaveProperty('id');
    expect(body.data).toHaveProperty('lawCode', code);
    LAW_ID = body.data.id;
  });

  it('GET /api/v1/laws/:id returns 200 for existing law', async () => {
    expect(LAW_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/laws/${LAW_ID}`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveProperty('id', LAW_ID);
  });

  it('PUT /api/v1/laws/:id updates a law', async () => {
    expect(LAW_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/laws/${LAW_ID}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ title: `Updated Law ${ts()}` }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.title).toContain('Updated Law');
  });

  // --- Invalid payloads ---
  it('POST /api/v1/laws with missing required fields returns 400', async () => {
    const res = await fetch(`${API}/api/v1/laws`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: 'Incomplete Law' }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/v1/laws with invalid lawCode format returns 400', async () => {
    const res = await fetch(`${API}/api/v1/laws`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        lawCode: 'INVALID',
        title: 'Bad Code Law',
        description: 'Test',
        severity: 'minor',
        auditLogic: 'Check',
        consequence: 'Nothing',
        appliesTo: 'all',
      }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/v1/laws with invalid severity returns 400', async () => {
    const res = await fetch(`${API}/api/v1/laws`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        lawCode: 'LAW-99999',
        title: 'Bad Severity Law',
        description: 'Test',
        severity: 'extreme',
        auditLogic: 'Check',
        consequence: 'Nothing',
        appliesTo: 'all',
      }),
    });
    expect(res.status).toBe(400);
  });

  // --- Nonexistent UUID ---
  it('GET /api/v1/laws/:id with nonexistent UUID returns 404', async () => {
    const res = await fetch(`${API}/api/v1/laws/${FAKE_UUID}`, { headers });
    expect(res.status).toBe(404);
  });
});

// ===========================================================================
// 9. Cases
// ===========================================================================
describe('Cases', () => {
  it('GET /api/v1/cases returns 200 with data array', async () => {
    const res = await fetch(`${API}/api/v1/cases`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('POST /api/v1/cases files a new case', async () => {
    expect(LAW_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/cases`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        accusedAgent: 'test-agent',
        lawId: LAW_ID,
        evidence: [
          {
            type: 'log',
            reference: 'test-ref-001',
            description: 'Integration test evidence',
          },
        ],
        severity: 'minor',
        filedBy: 'integration-test',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data).toHaveProperty('id');
    expect(body.data).toHaveProperty('status', 'open');
    CASE_ID = body.data.id;
  });

  it('GET /api/v1/cases/:id returns 200 for existing case', async () => {
    expect(CASE_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/cases/${CASE_ID}`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveProperty('id', CASE_ID);
  });

  it('PUT /api/v1/cases/:id/hearing starts a hearing', async () => {
    expect(CASE_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/cases/${CASE_ID}/hearing`, {
      method: 'PUT',
      headers: authOnly,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveProperty('status', 'hearing');
  });

  it('PUT /api/v1/cases/:id/verdict issues a verdict', async () => {
    expect(CASE_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/cases/${CASE_ID}/verdict`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        verdict: 'guilty',
        verdictReason: 'Integration test found agent guilty',
        deductionLevel: 'minor',
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveProperty('status', 'verdict');
    expect(body.data).toHaveProperty('verdict', 'guilty');
  });

  // --- Invalid payloads ---
  it('POST /api/v1/cases with missing evidence returns 400', async () => {
    const res = await fetch(`${API}/api/v1/cases`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        accusedAgent: 'test-agent',
        lawId: LAW_ID,
        severity: 'minor',
      }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/v1/cases with invalid severity returns 400', async () => {
    const res = await fetch(`${API}/api/v1/cases`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        accusedAgent: 'test-agent',
        lawId: LAW_ID,
        evidence: [{ type: 'log', reference: 'ref', description: 'desc' }],
        severity: 'extreme',
      }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/v1/cases with nonexistent lawId returns error', async () => {
    const res = await fetch(`${API}/api/v1/cases`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        accusedAgent: 'test-agent',
        lawId: FAKE_UUID,
        evidence: [{ type: 'log', reference: 'ref', description: 'desc' }],
        severity: 'minor',
      }),
    });
    // Should be 404 or 400 for nonexistent lawId
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});

// ===========================================================================
// 10. Agent Scores
// ===========================================================================
describe('Agent Scores', () => {
  it('GET /api/v1/agent-scores returns 200 with leaderboard', async () => {
    const res = await fetch(`${API}/api/v1/agent-scores`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('GET /api/v1/agent-scores/:agentName returns 200 for existing agent', async () => {
    const res = await fetch(`${API}/api/v1/agent-scores/bobby`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('agentName', 'bobby');
  });

  it('PUT /api/v1/agent-scores/:agentName/adjust adjusts score', async () => {
    const res = await fetch(`${API}/api/v1/agent-scores/bobby/adjust`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        delta: 0,
        reason: 'Integration test score adjustment (no-op)',
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveProperty('agentName', 'bobby');
    expect(body.data).toHaveProperty('totalScore');
  });

  // --- Invalid payloads ---
  it('PUT /api/v1/agent-scores/:agentName/adjust with missing delta returns 400', async () => {
    const res = await fetch(`${API}/api/v1/agent-scores/bobby/adjust`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ reason: 'No delta' }),
    });
    expect(res.status).toBe(400);
  });

  it('PUT /api/v1/agent-scores/:agentName/adjust with missing reason returns 400', async () => {
    const res = await fetch(`${API}/api/v1/agent-scores/bobby/adjust`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ delta: 10 }),
    });
    expect(res.status).toBe(400);
  });

  it('PUT /api/v1/agent-scores/:agentName/adjust with invalid delta type returns 400', async () => {
    const res = await fetch(`${API}/api/v1/agent-scores/bobby/adjust`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ delta: 'not-a-number', reason: 'Bad type' }),
    });
    expect(res.status).toBe(400);
  });
});

// ===========================================================================
// 11. Users
// ===========================================================================
describe('Users', () => {
  let USER_ID: string;

  it('GET /api/v1/users returns 200 with data array', async () => {
    const res = await fetch(`${API}/api/v1/users`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
    if (body.data.length > 0) {
      USER_ID = body.data[0].id;
    }
  });

  it('GET /api/v1/users/me returns 200 with current user', async () => {
    const res = await fetch(`${API}/api/v1/users/me`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveProperty('id');
    expect(body.data).toHaveProperty('email');
  });

  it('GET /api/v1/users/:id returns 200 for existing user', async () => {
    expect(USER_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/users/${USER_ID}`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveProperty('id', USER_ID);
  });

  // --- Nonexistent UUID ---
  it('GET /api/v1/users/:id with nonexistent UUID returns 404', async () => {
    const res = await fetch(`${API}/api/v1/users/${FAKE_UUID}`, { headers });
    expect(res.status).toBe(404);
  });
});

// ===========================================================================
// 12. Memberships
// ===========================================================================
describe('Memberships', () => {
  it('GET /api/v1/teams/:teamId/members returns 200 with members list', async () => {
    expect(TEAM_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/teams/${TEAM_ID}/members`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
  });
});

// ===========================================================================
// 13. Settings
// ===========================================================================
describe('Settings', () => {
  it('GET /api/v1/settings/webhook returns 200', async () => {
    const res = await fetch(`${API}/api/v1/settings/webhook`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('url');
  });

  it('PUT /api/v1/settings/webhook updates webhook URL', async () => {
    const testUrl = `https://example.com/webhook-${ts()}`;
    const res = await fetch(`${API}/api/v1/settings/webhook`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ url: testUrl }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('url', testUrl);
  });
});

// ===========================================================================
// 14. Me (Personal Scope)
// ===========================================================================
describe('Me (Personal Scope)', () => {
  it('GET /api/v1/me/scope returns 200', async () => {
    const res = await fetch(`${API}/api/v1/me/scope`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
  });

  it('GET /api/v1/me/projects returns 200 with project list', async () => {
    const res = await fetch(`${API}/api/v1/me/projects`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('POST /api/v1/me/projects creates a personal project', async () => {
    const res = await fetch(`${API}/api/v1/me/projects`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: `Personal Project ${ts()}`,
        description: 'Integration test personal project',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data).toHaveProperty('id');
  });

  it('GET /api/v1/me/statuses returns 200', async () => {
    const res = await fetch(`${API}/api/v1/me/statuses`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('GET /api/v1/me/work returns 200', async () => {
    const res = await fetch(`${API}/api/v1/me/work`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
  });

  it('GET /api/v1/me/blocked returns 200', async () => {
    const res = await fetch(`${API}/api/v1/me/blocked`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
  });

  // --- Invalid payloads ---
  it('POST /api/v1/me/projects with missing name returns 400', async () => {
    const res = await fetch(`${API}/api/v1/me/projects`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ description: 'No name' }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});

// ===========================================================================
// 15. Decisions
// ===========================================================================
describe('Decisions', () => {
  let DECISION_ID: string;

  it('GET /api/v1/decisions returns 200', async () => {
    const res = await fetch(`${API}/api/v1/decisions`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('POST /api/v1/decisions creates a decision', async () => {
    expect(EPIC_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/decisions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        epicId: EPIC_ID,
        question: `Should we use approach X? (${ts()})`,
        decision: 'Yes, use approach X',
        rationale: 'Integration test rationale',
        category: 'architecture',
        impact: 'low',
        madeBy: 'integration-test',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data).toHaveProperty('id');
    DECISION_ID = body.data.id;
  });

  it('GET /api/v1/decisions/:id returns 200 for existing decision', async () => {
    expect(DECISION_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/decisions/${DECISION_ID}`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveProperty('id', DECISION_ID);
  });

  // --- Invalid payloads ---
  it('POST /api/v1/decisions with missing required fields returns 400', async () => {
    const res = await fetch(`${API}/api/v1/decisions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ question: 'Incomplete decision' }),
    });
    expect(res.status).toBe(400);
  });

  // --- Nonexistent UUID ---
  it('GET /api/v1/decisions/:id with nonexistent UUID returns 404', async () => {
    const res = await fetch(`${API}/api/v1/decisions/${FAKE_UUID}`, { headers });
    expect(res.status).toBe(404);
  });
});

// ===========================================================================
// 16. Epic Requests
// ===========================================================================
describe('Epic Requests', () => {
  let EPIC_REQUEST_ID: string;

  it('GET /api/v1/epic-requests returns 200', async () => {
    const res = await fetch(`${API}/api/v1/epic-requests`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('POST /api/v1/epic-requests creates an epic request', async () => {
    const res = await fetch(`${API}/api/v1/epic-requests`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: `IntTest Epic Request ${ts()}`,
        description: 'Integration test epic request',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data).toHaveProperty('id');
    EPIC_REQUEST_ID = body.data.id;
  });

  it('GET /api/v1/epic-requests/:id returns 200', async () => {
    expect(EPIC_REQUEST_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/epic-requests/${EPIC_REQUEST_ID}`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveProperty('id', EPIC_REQUEST_ID);
  });

  it('POST /api/v1/epic-requests/:id/comments creates a comment', async () => {
    expect(EPIC_REQUEST_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/epic-requests/${EPIC_REQUEST_ID}/comments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ content: `Integration test comment ${ts()}` }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data).toHaveProperty('id');
    expect(body.data).toHaveProperty('content');
  });

  it('GET /api/v1/epic-requests/:id/comments returns 200', async () => {
    expect(EPIC_REQUEST_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/epic-requests/${EPIC_REQUEST_ID}/comments`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
  });

  // --- Invalid payloads ---
  it('POST /api/v1/epic-requests with missing title returns 400', async () => {
    const res = await fetch(`${API}/api/v1/epic-requests`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ description: 'No title' }),
    });
    expect(res.status).toBe(400);
  });

  // --- Nonexistent UUID ---
  it('GET /api/v1/epic-requests/:id with nonexistent UUID returns 404', async () => {
    const res = await fetch(`${API}/api/v1/epic-requests/${FAKE_UUID}`, { headers });
    expect(res.status).toBe(404);
  });
});

// ===========================================================================
// 17. Patterns
// ===========================================================================
describe('Patterns', () => {
  let PATTERN_ID: string;

  it('GET /api/v1/patterns returns 200', async () => {
    const res = await fetch(`${API}/api/v1/patterns`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('POST /api/v1/patterns creates a pattern', async () => {
    const res = await fetch(`${API}/api/v1/patterns`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: `IntTest Pattern ${ts()}`,
        category: 'testing',
        description: 'Integration test pattern',
        source: 'integration-tests',
        confidence: 0.8,
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data).toHaveProperty('id');
    PATTERN_ID = body.data.id;
  });

  it('GET /api/v1/patterns/:id returns 200 for existing pattern', async () => {
    expect(PATTERN_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/patterns/${PATTERN_ID}`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveProperty('id', PATTERN_ID);
  });

  it('PATCH /api/v1/patterns/:id updates a pattern', async () => {
    expect(PATTERN_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/patterns/${PATTERN_ID}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ confidence: 0.95 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.confidence).toBe(0.95);
  });

  // --- Nonexistent UUID ---
  it('GET /api/v1/patterns/:id with nonexistent UUID returns 404', async () => {
    const res = await fetch(`${API}/api/v1/patterns/${FAKE_UUID}`, { headers });
    expect(res.status).toBe(404);
  });

  // Cleanup
  it('DELETE /api/v1/patterns/:id deletes a pattern', async () => {
    expect(PATTERN_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/patterns/${PATTERN_ID}`, {
      method: 'DELETE',
      headers: authOnly,
    });
    expect(res.status).toBe(204);
  });
});

// ===========================================================================
// 18. Templates
// ===========================================================================
describe('Templates', () => {
  it('GET /api/v1/templates returns 200', async () => {
    const res = await fetch(`${API}/api/v1/templates`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
  });
});

// ===========================================================================
// 19. Changelog
// ===========================================================================
describe('Changelog', () => {
  it('GET /api/v1/changelog/epic/:epicId returns 200', async () => {
    expect(EPIC_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/changelog/epic/${EPIC_ID}`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
  });

  it('GET /api/v1/changelog/feature/:entityId returns 200', async () => {
    expect(FEATURE_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/changelog/feature/${FEATURE_ID}`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
  });

  it('GET /api/v1/changelog/task/:entityId returns 200', async () => {
    expect(TASK_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/changelog/task/${TASK_ID}`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
  });
});

// ===========================================================================
// 20. Execution Plans
// ===========================================================================
describe('Execution Plans', () => {
  it('GET /api/v1/execution-plans?epicId=... returns 200', async () => {
    expect(EPIC_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/execution-plans?epicId=${EPIC_ID}`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
  });
});

// ===========================================================================
// 21. User Activity
// ===========================================================================
describe('User Activity', () => {
  it('GET /api/v1/user-activity?interval=week returns 200', async () => {
    const res = await fetch(`${API}/api/v1/user-activity?interval=week`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
  });
});

// ===========================================================================
// 22. Tokens
// ===========================================================================
describe('Tokens', () => {
  it('GET /api/v1/tokens returns 200', async () => {
    const res = await fetch(`${API}/api/v1/tokens`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
  });
});

// ===========================================================================
// 23. Skill Packs (public routes)
// ===========================================================================
describe('Skill Packs', () => {
  it('GET /api/v1/skill-packs returns 200', async () => {
    const res = await fetch(`${API}/api/v1/skill-packs`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('GET /api/v1/skill-packs/installed returns 200', async () => {
    const res = await fetch(`${API}/api/v1/skill-packs/installed`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
  });
});

// ===========================================================================
// 24. Health Checks CRUD (inline routes in index.ts)
// ===========================================================================
describe('Health Checks CRUD', () => {
  let HEALTH_CHECK_ID: number;

  it('POST /api/v1/health-checks creates a record', async () => {
    const res = await fetch(`${API}/api/v1/health-checks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `inttest-${ts()}`, status: 'ok' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty('id');
    HEALTH_CHECK_ID = body.id;
  });

  it('GET /api/v1/health-checks returns all records', async () => {
    const res = await fetch(`${API}/api/v1/health-checks`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it('GET /api/v1/health-checks/:id returns specific record', async () => {
    expect(HEALTH_CHECK_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/health-checks/${HEALTH_CHECK_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('id', HEALTH_CHECK_ID);
  });

  it('PUT /api/v1/health-checks/:id updates a record', async () => {
    expect(HEALTH_CHECK_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/health-checks/${HEALTH_CHECK_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'updated' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('status', 'updated');
  });

  it('DELETE /api/v1/health-checks/:id deletes a record', async () => {
    expect(HEALTH_CHECK_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/health-checks/${HEALTH_CHECK_ID}`, {
      method: 'DELETE',
    });
    // Returns 200 or 204 depending on implementation
    expect([200, 204]).toContain(res.status);
  });

  it('GET /api/v1/health-checks/:id for deleted record returns 404', async () => {
    expect(HEALTH_CHECK_ID).toBeDefined();
    const res = await fetch(`${API}/api/v1/health-checks/${HEALTH_CHECK_ID}`);
    expect(res.status).toBe(404);
  });
});

// ===========================================================================
// 25. Cleanup: delete test entities created during the run
// ===========================================================================
describe('Cleanup', () => {
  it('DELETE /api/v1/epics/:id cleans up test epic (soft delete)', async () => {
    if (!EPIC_ID) return;
    const res = await fetch(`${API}/api/v1/epics/${EPIC_ID}`, {
      method: 'DELETE',
      headers: authOnly,
    });
    expect(res.status).toBeLessThan(500);
  });

  // Note: Law cleanup is skipped because the test case depends on it (FK constraint).
  // The law and case are left in the database as test artifacts.
});
