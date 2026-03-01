/**
 * ENG-84: Session Manager Validation
 *
 * Tests REAL HTTP requests against localhost:3001.
 * Covers session start, work logging, end with summary, and abandon flows.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const API = 'http://localhost:3001';
const AUTH = 'Bearer st_wShsQaYUgKEL9uJosNtLlLx2bqQe0t5tVCN9DxYWIVA';
const headers = { Authorization: AUTH, 'Content-Type': 'application/json' };
const authOnly = { Authorization: AUTH };
const ts = () => Date.now();

let TEAM_ID: string;
let EPIC_ID: string;
let EPIC_ID_2: string; // For abandon test
let SESSION_ID: string;
let SESSION_ID_2: string;
let FEATURE_ID: string;

// ---------------------------------------------------------------------------
// Setup: Create test epics for session testing
// ---------------------------------------------------------------------------
beforeAll(async () => {
  // Get first team
  const teamsRes = await fetch(`${API}/api/v1/teams`, { headers: authOnly });
  const teamsBody = await teamsRes.json();
  TEAM_ID = teamsBody.data[0].id;

  // Create test epics
  const epic1Res = await fetch(`${API}/api/v1/epics`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: `FT Session Epic ${ts()}`,
      teamId: TEAM_ID,
      description: 'Epic for session testing',
    }),
  });
  const epic1Body = await epic1Res.json();
  EPIC_ID = epic1Body.data.id;

  const epic2Res = await fetch(`${API}/api/v1/epics`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: `FT Session Abandon Epic ${ts()}`,
      teamId: TEAM_ID,
      description: 'Epic for session abandon testing',
    }),
  });
  const epic2Body = await epic2Res.json();
  EPIC_ID_2 = epic2Body.data.id;

  // Create a feature to log work against
  const featureRes = await fetch(`${API}/api/v1/features`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      epicId: EPIC_ID,
      title: `FT Session Feature ${ts()}`,
    }),
  });
  const featureBody = await featureRes.json();
  FEATURE_ID = featureBody.data.id;
});

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------
afterAll(async () => {
  // Abandon any active sessions before cleanup
  if (SESSION_ID) {
    await fetch(`${API}/api/v1/sessions/by-id/${SESSION_ID}/abandon`, {
      method: 'POST',
      headers: authOnly,
    }).catch(() => {});
  }
  if (SESSION_ID_2) {
    await fetch(`${API}/api/v1/sessions/by-id/${SESSION_ID_2}/abandon`, {
      method: 'POST',
      headers: authOnly,
    }).catch(() => {});
  }
  // Delete test epics
  for (const id of [EPIC_ID, EPIC_ID_2]) {
    if (id) {
      await fetch(`${API}/api/v1/epics/${id}`, {
        method: 'DELETE',
        headers: authOnly,
      }).catch(() => {});
    }
  }
});

// ===========================================================================
// ENG-84-1: Session Start + Active Session Retrieval
// ===========================================================================
describe('ENG-84-1: Session Start', () => {
  it('should start a new session for an epic', async () => {
    const res = await fetch(`${API}/api/v1/sessions/start`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        epicId: EPIC_ID,
      }),
    });
    expect(res.status, 'POST /sessions/start should return 201').toBe(201);
    const body = await res.json();
    expect(body.data, 'Response should contain data').toBeDefined();
    // The response could be { data: { session: ... } } or { data: { id: ... } }
    const sessionData = body.data.session || body.data;
    expect(sessionData.id, 'Session should have an ID').toBeDefined();
    expect(sessionData.status, 'Session should be active').toBe('active');
    SESSION_ID = sessionData.id;
  });

  it('should retrieve the active session', async () => {
    const res = await fetch(`${API}/api/v1/sessions/${EPIC_ID}/active`, {
      headers: authOnly,
    });
    expect(res.status, 'GET /sessions/:epicId/active should return 200').toBe(200);
    const body = await res.json();
    expect(body.data, 'Active session data should exist').toBeDefined();
    expect(body.data.id, 'Active session should match started session').toBe(SESSION_ID);
    expect(body.data.status, 'Active session should have active status').toBe('active');
  });

  it('should retrieve session by ID', async () => {
    const res = await fetch(`${API}/api/v1/sessions/by-id/${SESSION_ID}`, {
      headers: authOnly,
    });
    expect(res.status, 'GET /sessions/by-id/:id should return 200').toBe(200);
    const body = await res.json();
    expect(body.data.id, 'Session ID should match').toBe(SESSION_ID);
  });
});

// ===========================================================================
// ENG-84-2: Work Logging
// ===========================================================================
describe('ENG-84-2: Work Logging', () => {
  it('should log work on the active session', async () => {
    const res = await fetch(`${API}/api/v1/sessions/${EPIC_ID}/log-work`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        itemId: FEATURE_ID,
        itemType: 'feature',
        identifier: 'FT-001',
        action: 'started',
      }),
    });
    expect(res.status, 'POST /sessions/:epicId/log-work should return 200').toBe(200);
    const body = await res.json();
    expect(body.data, 'Work log response should contain data').toBeDefined();
  });

  it('should show events in session events endpoint', async () => {
    const res = await fetch(`${API}/api/v1/sessions/${EPIC_ID}/events`, {
      headers: authOnly,
    });
    expect(res.status, 'GET /sessions/:epicId/events should return 200').toBe(200);
    const body = await res.json();
    expect(body.data, 'Events response should contain data').toBeDefined();
    expect(body.data.events, 'Events data should have events array').toBeDefined();
  });
});

// ===========================================================================
// ENG-84-3: Session End with Summary
// ===========================================================================
describe('ENG-84-3: Session End with Summary', () => {
  it('should end the session with a summary', async () => {
    const res = await fetch(`${API}/api/v1/sessions/${EPIC_ID}/end`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        summary: 'Functional test session completed successfully',
        nextSteps: ['Run remaining tests', 'Fix any bugs found'],
        blockers: [],
        decisions: [{ decision: 'Use fetch for HTTP calls', rationale: 'Built-in Node.js API' }],
      }),
    });
    expect(res.status, 'POST /sessions/:epicId/end should return 200').toBe(200);
    const body = await res.json();
    expect(body.data, 'End session response should contain data').toBeDefined();
    expect(body.data.status, 'Ended session should have completed status').toBe('completed');
    expect(body.data.summary, 'Summary should be set').toBeDefined();
  });

  it('should appear in session history', async () => {
    const res = await fetch(`${API}/api/v1/sessions/${EPIC_ID}/history`, {
      headers: authOnly,
    });
    expect(res.status, 'GET /sessions/:epicId/history should return 200').toBe(200);
    const body = await res.json();
    expect(body.data, 'History should contain data').toBeDefined();
    // History can be an array or object with sessions property
    const sessions = Array.isArray(body.data) ? body.data : body.data.sessions || body.data;
    expect(Array.isArray(sessions), 'Sessions should be an array').toBe(true);
    const found = sessions.find((s: { id: string }) => s.id === SESSION_ID);
    expect(found, 'Completed session should appear in history').toBeDefined();
  });

  it('should no longer be active', async () => {
    const res = await fetch(`${API}/api/v1/sessions/${EPIC_ID}/active`, {
      headers: authOnly,
    });
    // Should return 404 since no active session exists
    expect(res.status, 'No active session should return 404').toBe(404);
  });
});

// ===========================================================================
// ENG-84-4: Session Abandon
// ===========================================================================
describe('ENG-84-4: Session Abandon', () => {
  it('should start a new session for abandon testing', async () => {
    const res = await fetch(`${API}/api/v1/sessions/start`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        epicId: EPIC_ID_2,
      }),
    });
    expect(res.status, 'POST /sessions/start should return 201').toBe(201);
    const body = await res.json();
    const sessionData = body.data.session || body.data;
    SESSION_ID_2 = sessionData.id;
  });

  it('should abandon the session', async () => {
    const res = await fetch(`${API}/api/v1/sessions/by-id/${SESSION_ID_2}/abandon`, {
      method: 'POST',
      headers: authOnly,
    });
    expect(res.status, 'POST /sessions/by-id/:id/abandon should return 200').toBe(200);
    const body = await res.json();
    expect(body.data.status, 'Abandoned session should have abandoned status').toBe('abandoned');
  });

  it('should show abandoned status when fetched by ID', async () => {
    const res = await fetch(`${API}/api/v1/sessions/by-id/${SESSION_ID_2}`, {
      headers: authOnly,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status, 'Session status should be abandoned').toBe('abandoned');
  });

  it('should no longer be active after abandon', async () => {
    const res = await fetch(`${API}/api/v1/sessions/${EPIC_ID_2}/active`, {
      headers: authOnly,
    });
    expect(res.status, 'No active session after abandon should return 404').toBe(404);
  });
});
