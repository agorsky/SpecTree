/**
 * ENG-83: Epic Lifecycle End-to-End Validation
 *
 * Tests REAL HTTP requests against localhost:3001.
 * Covers the full epic lifecycle including epic requests, CRUD, hierarchy,
 * status transitions, and archive/unarchive operations.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const API = 'http://localhost:3001';
const AUTH = 'Bearer st_wShsQaYUgKEL9uJosNtLlLx2bqQe0t5tVCN9DxYWIVA';
const headers = { Authorization: AUTH, 'Content-Type': 'application/json' };
const authOnly = { Authorization: AUTH };
const ts = () => Date.now();

// Shared state populated during test execution
let TEAM_ID: string;
let EPIC_ID: string;
let FEATURE_ID: string;
let TASK_ID: string;
let STATUS_BACKLOG_ID: string;
let STATUS_IN_PROGRESS_ID: string;
let STATUS_DONE_ID: string;
let EPIC_REQUEST_ID: string;

// ---------------------------------------------------------------------------
// Setup: Discover team and statuses
// ---------------------------------------------------------------------------
beforeAll(async () => {
  // Get first team
  const teamsRes = await fetch(`${API}/api/v1/teams`, { headers: authOnly });
  expect(teamsRes.status, 'Should be able to list teams').toBe(200);
  const teamsBody = await teamsRes.json();
  expect(teamsBody.data.length, 'At least one team must exist').toBeGreaterThan(0);
  TEAM_ID = teamsBody.data[0].id;

  // Get statuses for the team
  const statusRes = await fetch(`${API}/api/v1/statuses`, { headers: authOnly });
  expect(statusRes.status, 'Should be able to list statuses').toBe(200);
  const statusBody = await statusRes.json();

  const statuses = statusBody.data;
  // Must use team-scoped statuses (not global/null) to avoid "different team" validation error
  const backlog = statuses.find((s: { category: string; teamId: string | null }) => s.category === 'backlog' && s.teamId === TEAM_ID);
  const started = statuses.find((s: { category: string; teamId: string | null }) => s.category === 'started' && s.teamId === TEAM_ID);
  const completed = statuses.find((s: { category: string; teamId: string | null }) => s.category === 'completed' && s.teamId === TEAM_ID);

  expect(backlog, 'Backlog status must exist').toBeDefined();
  expect(started, 'Started status must exist').toBeDefined();
  expect(completed, 'Completed status must exist').toBeDefined();

  STATUS_BACKLOG_ID = backlog.id;
  STATUS_IN_PROGRESS_ID = started.id;
  STATUS_DONE_ID = completed.id;
});

// ---------------------------------------------------------------------------
// Cleanup: Delete test epic (cascades to features/tasks)
// ---------------------------------------------------------------------------
afterAll(async () => {
  if (EPIC_ID) {
    await fetch(`${API}/api/v1/epics/${EPIC_ID}`, {
      method: 'DELETE',
      headers: authOnly,
    });
  }
  if (EPIC_REQUEST_ID) {
    await fetch(`${API}/api/v1/epic-requests/${EPIC_REQUEST_ID}`, {
      method: 'DELETE',
      headers: authOnly,
    });
  }
});

// ===========================================================================
// ENG-83-1: Epic Request Lifecycle
// ===========================================================================
describe('ENG-83-1: Epic Request Lifecycle', () => {
  it('should create an epic request', async () => {
    const res = await fetch(`${API}/api/v1/epic-requests`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: `Functional Test Epic Request ${ts()}`,
        description: 'Created by ENG-83 functional test',
      }),
    });
    expect(res.status, 'POST /epic-requests should return 201').toBe(201);
    const body = await res.json();
    expect(body.data, 'Response should contain data').toBeDefined();
    expect(body.data.id, 'Epic request should have an ID').toBeDefined();
    expect(body.data.status, 'New epic request should be pending').toBe('pending');
    EPIC_REQUEST_ID = body.data.id;
  });

  it('should retrieve the epic request by ID', async () => {
    expect(EPIC_REQUEST_ID, 'Epic request ID must be set').toBeDefined();
    const res = await fetch(`${API}/api/v1/epic-requests/${EPIC_REQUEST_ID}`, {
      headers: authOnly,
    });
    expect(res.status, 'GET /epic-requests/:id should return 200').toBe(200);
    const body = await res.json();
    expect(body.data.id, 'Should return the correct epic request').toBe(EPIC_REQUEST_ID);
  });

  it('should approve the epic request', async () => {
    expect(EPIC_REQUEST_ID, 'Epic request ID must be set').toBeDefined();
    const res = await fetch(`${API}/api/v1/epic-requests/${EPIC_REQUEST_ID}/approve`, {
      method: 'POST',
      headers: authOnly,
    });
    expect(res.status, 'POST /epic-requests/:id/approve should return 200').toBe(200);
    const body = await res.json();
    expect(body.data.status, 'Approved request should have status approved').toBe('approved');
  });

  it('should verify approved status persists on re-fetch', async () => {
    const res = await fetch(`${API}/api/v1/epic-requests/${EPIC_REQUEST_ID}`, {
      headers: authOnly,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status, 'Status should remain approved on re-fetch').toBe('approved');
  });
});

// ===========================================================================
// ENG-83-2: Epic CRUD
// ===========================================================================
describe('ENG-83-2: Epic CRUD', () => {
  it('should create an epic', async () => {
    const res = await fetch(`${API}/api/v1/epics`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: `FT Epic ${ts()}`,
        teamId: TEAM_ID,
        description: 'Created by ENG-83 functional test',
        icon: '🧪',
        color: '#ff5733',
      }),
    });
    expect(res.status, 'POST /epics should return 201').toBe(201);
    const body = await res.json();
    expect(body.data.id, 'Epic should have an ID').toBeDefined();
    expect(body.data.name, 'Epic name should be set').toContain('FT Epic');
    expect(body.data.teamId, 'Epic should belong to the team').toBe(TEAM_ID);
    EPIC_ID = body.data.id;
  });

  it('should read epic by ID', async () => {
    const res = await fetch(`${API}/api/v1/epics/${EPIC_ID}`, { headers: authOnly });
    expect(res.status, 'GET /epics/:id should return 200').toBe(200);
    const body = await res.json();
    expect(body.data.id, 'Returned epic should match requested ID').toBe(EPIC_ID);
  });

  it('should update epic name', async () => {
    const newName = `FT Epic Updated ${ts()}`;
    const res = await fetch(`${API}/api/v1/epics/${EPIC_ID}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ name: newName }),
    });
    expect(res.status, 'PUT /epics/:id should return 200').toBe(200);
    const body = await res.json();
    expect(body.data.name, 'Epic name should be updated').toBe(newName);
  });

  it('should list epics with filters', async () => {
    const res = await fetch(`${API}/api/v1/epics?teamId=${TEAM_ID}&limit=5`, {
      headers: authOnly,
    });
    expect(res.status, 'GET /epics with filters should return 200').toBe(200);
    const body = await res.json();
    expect(body.data, 'Response should contain data array').toBeDefined();
    expect(Array.isArray(body.data), 'data should be an array').toBe(true);
    const found = body.data.find((e: { id: string }) => e.id === EPIC_ID);
    expect(found, 'Created epic should appear in list').toBeDefined();
  });
});

// ===========================================================================
// ENG-83-3: Feature + Task hierarchy under an Epic
// ===========================================================================
describe('ENG-83-3: Feature + Task under Epic', () => {
  it('should create a feature under the epic', async () => {
    const res = await fetch(`${API}/api/v1/features`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        epicId: EPIC_ID,
        title: `FT Feature ${ts()}`,
      }),
    });
    expect(res.status, 'POST /features should return 201').toBe(201);
    const body = await res.json();
    expect(body.data.epicId, 'Feature should be under the correct epic').toBe(EPIC_ID);
    FEATURE_ID = body.data.id;
  });

  it('should create a task under the feature', async () => {
    const res = await fetch(`${API}/api/v1/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        featureId: FEATURE_ID,
        title: `FT Task ${ts()}`,
      }),
    });
    expect(res.status, 'POST /tasks should return 201').toBe(201);
    const body = await res.json();
    expect(body.data.featureId, 'Task should be under the correct feature').toBe(FEATURE_ID);
    TASK_ID = body.data.id;
  });

  it('should verify parent relationships via epic detail', async () => {
    const res = await fetch(`${API}/api/v1/epics/${EPIC_ID}`, { headers: authOnly });
    expect(res.status).toBe(200);
    const body = await res.json();
    // Epic detail should include features
    const features = body.data.features || body.data._count?.features;
    expect(features, 'Epic should have features data').toBeDefined();
  });

  it('should verify feature belongs to epic via feature detail', async () => {
    const res = await fetch(`${API}/api/v1/features/${FEATURE_ID}`, { headers: authOnly });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.epicId, 'Feature epicId should match parent epic').toBe(EPIC_ID);
  });

  it('should verify task belongs to feature via task detail', async () => {
    const res = await fetch(`${API}/api/v1/tasks/${TASK_ID}`, { headers: authOnly });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.featureId, 'Task featureId should match parent feature').toBe(FEATURE_ID);
  });
});

// ===========================================================================
// ENG-83-4: Status Transitions
// ===========================================================================
describe('ENG-83-4: Status Transitions', () => {
  it('should transition task from Backlog → In Progress', async () => {
    const res = await fetch(`${API}/api/v1/tasks/${TASK_ID}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ statusId: STATUS_IN_PROGRESS_ID }),
    });
    expect(res.status, 'PUT task status to In Progress should return 200').toBe(200);
    const body = await res.json();
    expect(body.data.statusId, 'Task statusId should be In Progress').toBe(STATUS_IN_PROGRESS_ID);
  });

  it('should transition task from In Progress → Done', async () => {
    const res = await fetch(`${API}/api/v1/tasks/${TASK_ID}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ statusId: STATUS_DONE_ID }),
    });
    expect(res.status, 'PUT task status to Done should return 200').toBe(200);
    const body = await res.json();
    expect(body.data.statusId, 'Task statusId should be Done').toBe(STATUS_DONE_ID);
  });

  it('should transition feature from Backlog → In Progress', async () => {
    const res = await fetch(`${API}/api/v1/features/${FEATURE_ID}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ statusId: STATUS_IN_PROGRESS_ID }),
    });
    expect(res.status, 'PUT feature status to In Progress should return 200').toBe(200);
    const body = await res.json();
    expect(body.data.statusId, 'Feature statusId should be In Progress').toBe(STATUS_IN_PROGRESS_ID);
  });

  it('should transition feature from In Progress → Done', async () => {
    const res = await fetch(`${API}/api/v1/features/${FEATURE_ID}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ statusId: STATUS_DONE_ID }),
    });
    expect(res.status, 'PUT feature status to Done should return 200').toBe(200);
    const body = await res.json();
    expect(body.data.statusId, 'Feature statusId should be Done').toBe(STATUS_DONE_ID);
  });
});

// ===========================================================================
// ENG-83-5: Archive / Unarchive
// ===========================================================================
describe('ENG-83-5: Archive / Unarchive', () => {
  it('should archive an epic', async () => {
    const res = await fetch(`${API}/api/v1/epics/${EPIC_ID}/archive`, {
      method: 'POST',
      headers: authOnly,
    });
    expect(res.status, 'POST /epics/:id/archive should return 200').toBe(200);
    const body = await res.json();
    expect(body.data.isArchived, 'Epic should be archived').toBe(true);
  });

  it('should not appear in default epic listing (archived)', async () => {
    const res = await fetch(`${API}/api/v1/epics?teamId=${TEAM_ID}`, {
      headers: authOnly,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    const found = body.data.find((e: { id: string }) => e.id === EPIC_ID);
    expect(found, 'Archived epic should not appear in default listing').toBeUndefined();
  });

  it('should appear when includeArchived=true', async () => {
    const res = await fetch(`${API}/api/v1/epics?teamId=${TEAM_ID}&includeArchived=true`, {
      headers: authOnly,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    const found = body.data.find((e: { id: string }) => e.id === EPIC_ID);
    expect(found, 'Archived epic should appear with includeArchived=true').toBeDefined();
  });

  it('should unarchive an epic', async () => {
    const res = await fetch(`${API}/api/v1/epics/${EPIC_ID}/unarchive`, {
      method: 'POST',
      headers: authOnly,
    });
    expect(res.status, 'POST /epics/:id/unarchive should return 200').toBe(200);
    const body = await res.json();
    expect(body.data.isArchived, 'Epic should be unarchived').toBe(false);
  });

  it('should appear in default listing after unarchive', async () => {
    const res = await fetch(`${API}/api/v1/epics?teamId=${TEAM_ID}`, {
      headers: authOnly,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    const found = body.data.find((e: { id: string }) => e.id === EPIC_ID);
    expect(found, 'Unarchived epic should appear in default listing').toBeDefined();
    expect(found.isArchived, 'isArchived should be false').toBe(false);
  });
});
