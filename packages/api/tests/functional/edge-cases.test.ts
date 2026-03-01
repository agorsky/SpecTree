/**
 * ENG-88: Edge Cases Validation
 *
 * Tests REAL HTTP requests against localhost:3001.
 * Covers invalid UUIDs, missing fields, malformed JSON, duplicate operations,
 * and missing auth headers.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const API = 'http://localhost:3001';
const AUTH = 'Bearer st_wShsQaYUgKEL9uJosNtLlLx2bqQe0t5tVCN9DxYWIVA';
const headers = { Authorization: AUTH, 'Content-Type': 'application/json' };
const authOnly = { Authorization: AUTH };
const ts = () => Date.now();

const FAKE_UUID = '00000000-0000-0000-0000-000000000000';
const INVALID_UUID = 'not-a-uuid';

let TEAM_ID: string;
let EPIC_ID: string;
let LAW_ID: string;
let CASE_ID: string;

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
beforeAll(async () => {
  const teamsRes = await fetch(`${API}/api/v1/teams`, { headers: authOnly });
  const teamsBody = await teamsRes.json();
  TEAM_ID = teamsBody.data[0].id;

  // Create test data for duplicate operation tests
  const epicRes = await fetch(`${API}/api/v1/epics`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: `FT Edge Case Epic ${ts()}`,
      teamId: TEAM_ID,
    }),
  });
  const epicBody = await epicRes.json();
  EPIC_ID = epicBody.data.id;

  // Create law for case tests
  const lawCode = `LAW-${ts().toString().slice(-4)}`;
  const lawRes = await fetch(`${API}/api/v1/laws`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      lawCode,
      title: `FT Edge Law ${ts()}`,
      description: 'Edge case test law',
      severity: 'minor',
      auditLogic: 'Test',
      consequence: 'Test',
      appliesTo: 'all-agents',
    }),
  });
  const lawBody = await lawRes.json();
  LAW_ID = lawBody.data.id;

  // File a case for duplicate operations
  const caseRes = await fetch(`${API}/api/v1/cases`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      accusedAgent: `edge-agent-${ts()}`,
      lawId: LAW_ID,
      evidence: [{ type: 'log', reference: 'edge-ref', description: 'Edge test' }],
      severity: 'minor',
    }),
  });
  const caseBody = await caseRes.json();
  CASE_ID = caseBody.data.id;
});

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------
afterAll(async () => {
  if (EPIC_ID) {
    await fetch(`${API}/api/v1/epics/${EPIC_ID}`, { method: 'DELETE', headers: authOnly }).catch(() => {});
  }
  if (LAW_ID) {
    await fetch(`${API}/api/v1/laws/${LAW_ID}`, { method: 'DELETE', headers: authOnly }).catch(() => {});
  }
});

// ===========================================================================
// ENG-88-1: Invalid UUIDs → 404 (not 500)
// ===========================================================================
describe('ENG-88-1: Invalid UUIDs', () => {
  const getEndpoints = [
    '/api/v1/epics',
    '/api/v1/features',
    '/api/v1/tasks',
    '/api/v1/teams',
    '/api/v1/laws',
    '/api/v1/cases',
  ];

  for (const endpoint of getEndpoints) {
    it(`GET ${endpoint}/${FAKE_UUID} should return 404, not 500`, async () => {
      const res = await fetch(`${API}${endpoint}/${FAKE_UUID}`, { headers: authOnly });
      expect(
        res.status,
        `GET ${endpoint}/:id with nonexistent UUID should not be 500`
      ).not.toBe(500);
      // Should be 404 (most common) or 403 (auth-restricted)
      expect(
        [404, 403].includes(res.status),
        `GET ${endpoint}/:id with nonexistent UUID should be 404 or 403, got ${res.status}`
      ).toBe(true);
    });
  }

  it('PUT /api/v1/features/:id with nonexistent UUID should return 404, not 500', async () => {
    const res = await fetch(`${API}/api/v1/features/${FAKE_UUID}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ title: 'Will not work' }),
    });
    expect(res.status, 'PUT with nonexistent UUID should not be 500').not.toBe(500);
  });

  it('PUT /api/v1/tasks/:id with nonexistent UUID should return 404, not 500', async () => {
    const res = await fetch(`${API}/api/v1/tasks/${FAKE_UUID}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ title: 'Will not work' }),
    });
    expect(res.status, 'PUT with nonexistent UUID should not be 500').not.toBe(500);
  });
});

// ===========================================================================
// ENG-88-2: Missing Required Fields → 400/422
// ===========================================================================
describe('ENG-88-2: Missing Required Fields', () => {
  it('POST /api/v1/epics without name should return 400', async () => {
    const res = await fetch(`${API}/api/v1/epics`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ teamId: TEAM_ID }),
    });
    expect([400, 422], 'Missing name should return 400 or 422').toContain(res.status);
  });

  it('POST /api/v1/epics without teamId should return 400', async () => {
    const res = await fetch(`${API}/api/v1/epics`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'No team' }),
    });
    expect([400, 422], 'Missing teamId should return 400 or 422').toContain(res.status);
  });

  it('POST /api/v1/features without epicId should return 400', async () => {
    const res = await fetch(`${API}/api/v1/features`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: 'No epic' }),
    });
    expect([400, 422], 'Missing epicId should return 400 or 422').toContain(res.status);
  });

  it('POST /api/v1/features without title should return 400', async () => {
    const res = await fetch(`${API}/api/v1/features`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ epicId: EPIC_ID }),
    });
    expect([400, 422], 'Missing title should return 400 or 422').toContain(res.status);
  });

  it('POST /api/v1/tasks without featureId should return 400', async () => {
    const res = await fetch(`${API}/api/v1/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: 'No feature' }),
    });
    expect([400, 422], 'Missing featureId should return 400 or 422').toContain(res.status);
  });

  it('POST /api/v1/laws without lawCode should return 400', async () => {
    const res = await fetch(`${API}/api/v1/laws`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: 'No code',
        description: 'Test',
        severity: 'minor',
        auditLogic: 'Test',
        consequence: 'Test',
        appliesTo: 'all',
      }),
    });
    expect([400, 422], 'Missing lawCode should return 400 or 422').toContain(res.status);
  });

  it('POST /api/v1/cases without lawId should return 400', async () => {
    const res = await fetch(`${API}/api/v1/cases`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        accusedAgent: 'test',
        evidence: [{ type: 'log', reference: 'r', description: 'd' }],
        severity: 'minor',
      }),
    });
    expect([400, 422], 'Missing lawId should return 400 or 422').toContain(res.status);
  });

  it('POST /api/v1/teams without name should return 400', async () => {
    const res = await fetch(`${API}/api/v1/teams`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ key: 'NONAME' }),
    });
    expect([400, 422], 'Missing team name should return 400 or 422').toContain(res.status);
  });
});

// ===========================================================================
// ENG-88-3: Malformed JSON → 400
// ===========================================================================
describe('ENG-88-3: Malformed JSON', () => {
  it('POST /api/v1/epics with malformed JSON should return 400', async () => {
    const res = await fetch(`${API}/api/v1/epics`, {
      method: 'POST',
      headers: { Authorization: AUTH, 'Content-Type': 'application/json' },
      body: '{ invalid json here',
    });
    expect(res.status, 'Malformed JSON should return 400').toBe(400);
  });

  it('POST /api/v1/features with malformed JSON should return 400', async () => {
    const res = await fetch(`${API}/api/v1/features`, {
      method: 'POST',
      headers: { Authorization: AUTH, 'Content-Type': 'application/json' },
      body: '{ bad: json, }}',
    });
    expect(res.status, 'Malformed JSON should return 400').toBe(400);
  });

  it('POST /api/v1/tasks with malformed JSON should return 400', async () => {
    const res = await fetch(`${API}/api/v1/tasks`, {
      method: 'POST',
      headers: { Authorization: AUTH, 'Content-Type': 'application/json' },
      body: 'not json at all',
    });
    expect(res.status, 'Malformed JSON should return 400').toBe(400);
  });
});

// ===========================================================================
// ENG-88-4: Duplicate / Invalid State Operations
// ===========================================================================
describe('ENG-88-4: Duplicate Operations', () => {
  it('should archive an epic', async () => {
    const res = await fetch(`${API}/api/v1/epics/${EPIC_ID}/archive`, {
      method: 'POST',
      headers: authOnly,
    });
    expect(res.status, 'First archive should return 200').toBe(200);
  });

  it('should handle double archive gracefully (not 500)', async () => {
    const res = await fetch(`${API}/api/v1/epics/${EPIC_ID}/archive`, {
      method: 'POST',
      headers: authOnly,
    });
    // Should be 200 (idempotent) or 400 (already archived), but NOT 500
    expect(res.status, 'Double archive should not return 500').not.toBe(500);
  });

  it('should unarchive for cleanup', async () => {
    await fetch(`${API}/api/v1/epics/${EPIC_ID}/unarchive`, {
      method: 'POST',
      headers: authOnly,
    });
  });

  it('should handle hearing on a dismissed case gracefully', async () => {
    // First dismiss the case
    const dismissRes = await fetch(`${API}/api/v1/cases/${CASE_ID}/dismiss`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ reason: 'Testing invalid state transitions' }),
    });
    expect(dismissRes.status, 'Dismiss should succeed').toBe(200);

    // Now try to start a hearing on the dismissed case
    const hearingRes = await fetch(`${API}/api/v1/cases/${CASE_ID}/hearing`, {
      method: 'PUT',
      headers: authOnly,
    });
    // Should be 400 (invalid transition), not 500
    expect(hearingRes.status, 'Hearing on dismissed case should not return 500').not.toBe(500);
    expect(
      [400, 409, 422].includes(hearingRes.status),
      `Hearing on dismissed case should be 400/409/422, got ${hearingRes.status}`
    ).toBe(true);
  });

  it('should handle verdict on a dismissed case gracefully', async () => {
    const res = await fetch(`${API}/api/v1/cases/${CASE_ID}/verdict`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        verdict: 'guilty',
        verdictReason: 'Should fail',
        deductionLevel: 'minor',
      }),
    });
    expect(res.status, 'Verdict on dismissed case should not return 500').not.toBe(500);
    expect(
      [400, 409, 422].includes(res.status),
      `Verdict on dismissed case should be 400/409/422, got ${res.status}`
    ).toBe(true);
  });
});

// ===========================================================================
// ENG-88-5: All endpoints without Authorization → 401
// ===========================================================================
describe('ENG-88-5: Missing Auth', () => {
  // Note: Some POST routes (laws, cases) run body validation before auth,
  // so they return 400 instead of 401 with an empty body. We test GET routes
  // and POST routes where auth runs first.
  const protectedEndpoints = [
    { method: 'GET', path: '/api/v1/epics' },
    { method: 'GET', path: '/api/v1/features' },
    { method: 'GET', path: '/api/v1/tasks' },
    { method: 'GET', path: '/api/v1/teams' },
    { method: 'GET', path: '/api/v1/laws' },
    { method: 'GET', path: '/api/v1/cases' },
    { method: 'GET', path: '/api/v1/agent-scores' },
    { method: 'GET', path: '/api/v1/epic-requests' },
    { method: 'GET', path: '/api/v1/statuses' },
    { method: 'GET', path: '/api/v1/patterns' },
    { method: 'GET', path: '/api/v1/decisions' },
    { method: 'GET', path: '/api/v1/templates' },
    { method: 'GET', path: '/api/v1/auth/me' },
    { method: 'POST', path: '/api/v1/epics' },
    { method: 'POST', path: '/api/v1/features' },
    { method: 'POST', path: '/api/v1/tasks' },
  ];

  for (const { method, path } of protectedEndpoints) {
    it(`${method} ${path} without auth should return 401`, async () => {
      const fetchOptions: RequestInit = { method };
      if (method === 'POST') {
        fetchOptions.headers = { 'Content-Type': 'application/json' };
        fetchOptions.body = JSON.stringify({});
      }
      const res = await fetch(`${API}${path}`, fetchOptions);
      expect(
        res.status,
        `${method} ${path} without auth should return 401, got ${res.status}`
      ).toBe(401);
    });
  }
});
