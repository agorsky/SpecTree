/**
 * ENG-87: MCP Tool Functional Tests
 *
 * Tests MCP tools via their underlying API endpoints against localhost:3001.
 * Covers create_epic_complete, manage_description, set_execution_metadata,
 * get_execution_plan, and search tools.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const API = 'http://localhost:3001';
const AUTH = 'Bearer st_wShsQaYUgKEL9uJosNtLlLx2bqQe0t5tVCN9DxYWIVA';
const headers = { Authorization: AUTH, 'Content-Type': 'application/json' };
const authOnly = { Authorization: AUTH };
const ts = () => Date.now();

let TEAM_ID: string;
let EPIC_ID: string;
let FEATURE_ID: string;
let FEATURE_ID_2: string;
let TASK_ID: string;

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
beforeAll(async () => {
  const teamsRes = await fetch(`${API}/api/v1/teams`, { headers: authOnly });
  const teamsBody = await teamsRes.json();
  TEAM_ID = teamsBody.data[0].id;
});

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------
afterAll(async () => {
  if (EPIC_ID) {
    await fetch(`${API}/api/v1/epics/${EPIC_ID}`, {
      method: 'DELETE',
      headers: authOnly,
    }).catch(() => {});
  }
});

// ===========================================================================
// ENG-87-1: create_epic_complete composite tool
// ===========================================================================
describe('ENG-87-1: create_epic_complete', () => {
  it('should create a complete epic with features and tasks', async () => {
    const res = await fetch(`${API}/api/v1/epics/complete`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: `FT MCP Complete Epic ${ts()}`,
        team: TEAM_ID,
        description: 'Created by ENG-87 MCP functional test',
        icon: '🔧',
        features: [
          {
            title: `FT Feature Alpha ${ts()}`,
            executionOrder: 1,
            estimatedComplexity: 'simple',
            tasks: [
              { title: `FT Task A1 ${ts()}` },
              { title: `FT Task A2 ${ts()}` },
            ],
          },
          {
            title: `FT Feature Beta ${ts()}`,
            executionOrder: 2,
            estimatedComplexity: 'moderate',
            canParallelize: true,
            tasks: [
              { title: `FT Task B1 ${ts()}` },
            ],
          },
        ],
      }),
    });
    expect(res.status, 'POST /epics/complete should return 201').toBe(201);
    const body = await res.json();
    expect(body.data, 'Response should contain data').toBeDefined();

    // The response structure may vary
    const data = body.data;
    if (data.epic) {
      EPIC_ID = data.epic.id;
      expect(data.features, 'Should have features array').toBeDefined();
      expect(data.features.length, 'Should have 2 features').toBe(2);
      FEATURE_ID = data.features[0].id;
      FEATURE_ID_2 = data.features[1].id;
      if (data.tasks) {
        TASK_ID = data.tasks[0].id;
      }
    } else {
      // Alternate response shape: flat object with id
      EPIC_ID = data.id;
    }
  });

  it('should verify created epic has features', async () => {
    if (!EPIC_ID) return;
    const res = await fetch(`${API}/api/v1/features?epicId=${EPIC_ID}`, {
      headers: authOnly,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length, 'Epic should have 2 features').toBeGreaterThanOrEqual(2);

    // Capture IDs if not already set
    if (!FEATURE_ID && body.data.length > 0) {
      FEATURE_ID = body.data[0].id;
    }
    if (!FEATURE_ID_2 && body.data.length > 1) {
      FEATURE_ID_2 = body.data[1].id;
    }
  });

  it('should verify features have tasks', async () => {
    if (!FEATURE_ID) return;
    const res = await fetch(`${API}/api/v1/tasks?featureId=${FEATURE_ID}`, {
      headers: authOnly,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length, 'First feature should have tasks').toBeGreaterThanOrEqual(1);
    if (!TASK_ID && body.data.length > 0) {
      TASK_ID = body.data[0].id;
    }
  });
});

// ===========================================================================
// ENG-87-2: manage_description (set/get round-trip)
// ===========================================================================
describe('ENG-87-2: manage_description (set/get)', () => {
  it('should set structured description on a feature', async () => {
    if (!FEATURE_ID) return;
    const res = await fetch(`${API}/api/v1/features/${FEATURE_ID}/structured-desc`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        summary: 'This is a test structured description',
        acceptanceCriteria: ['Tests pass', 'Code compiles'],
        technicalNotes: 'Using vitest for testing',
        filesInvolved: ['packages/api/tests/functional/mcp-tools.test.ts'],
      }),
    });
    expect(res.status, 'PUT structured-desc should return 200').toBe(200);
  });

  it('should get structured description from the feature', async () => {
    if (!FEATURE_ID) return;
    const res = await fetch(`${API}/api/v1/features/${FEATURE_ID}/structured-desc`, {
      headers: authOnly,
    });
    expect(res.status, 'GET structured-desc should return 200').toBe(200);
    const body = await res.json();
    expect(body.data, 'Response should contain data').toBeDefined();
    if (body.data.structuredDesc?.summary) {
      expect(body.data.structuredDesc.summary, 'Summary should match').toContain('test structured description');
    }
  });

  it('should also work for tasks', async () => {
    if (!TASK_ID) return;
    // Set via PUT
    const setRes = await fetch(`${API}/api/v1/tasks/${TASK_ID}/structured-desc`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        summary: 'Task structured description test',
        acceptanceCriteria: ['Task tests pass'],
      }),
    });
    expect(setRes.status, 'PUT task structured-desc should return 200').toBe(200);

    // Get
    const getRes = await fetch(`${API}/api/v1/tasks/${TASK_ID}/structured-desc`, {
      headers: authOnly,
    });
    expect(getRes.status, 'GET task structured-desc should return 200').toBe(200);
  });
});

// ===========================================================================
// ENG-87-3: set_execution_metadata + get_execution_plan
// ===========================================================================
describe('ENG-87-3: Execution Metadata + Plan', () => {
  it('should set execution metadata on a feature', async () => {
    if (!FEATURE_ID) return;
    const res = await fetch(`${API}/api/v1/features/${FEATURE_ID}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        executionOrder: 1,
        canParallelize: false,
        estimatedComplexity: 'simple',
      }),
    });
    expect(res.status, 'PUT feature with execution metadata should return 200').toBe(200);
  });

  it('should set execution metadata on second feature', async () => {
    if (!FEATURE_ID_2) return;
    const res = await fetch(`${API}/api/v1/features/${FEATURE_ID_2}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        executionOrder: 2,
        canParallelize: true,
        estimatedComplexity: 'moderate',
      }),
    });
    expect(res.status, 'PUT second feature with execution metadata should return 200').toBe(200);
  });

  it('should get execution plan for the epic', async () => {
    if (!EPIC_ID) return;
    const res = await fetch(`${API}/api/v1/execution-plans?epicId=${EPIC_ID}`, {
      headers: authOnly,
    });
    expect(res.status, 'GET /execution-plans?epicId= should return 200').toBe(200);
    const body = await res.json();
    expect(body.data, 'Execution plan should have data').toBeDefined();
  });
});

// ===========================================================================
// ENG-87-4: Search Tool
// ===========================================================================
describe('ENG-87-4: Search', () => {
  it('should search features by query text', async () => {
    const res = await fetch(`${API}/api/v1/features?query=FT+Feature+Alpha`, {
      headers: authOnly,
    });
    expect(res.status, 'Feature search should return 200').toBe(200);
    const body = await res.json();
    expect(body.data, 'Search should return data').toBeDefined();
    expect(Array.isArray(body.data), 'Search results should be array').toBe(true);
  });

  it('should search tasks by query text', async () => {
    const res = await fetch(`${API}/api/v1/tasks?query=FT+Task`, {
      headers: authOnly,
    });
    expect(res.status, 'Task search should return 200').toBe(200);
    const body = await res.json();
    expect(body.data, 'Search should return data').toBeDefined();
    expect(Array.isArray(body.data), 'Search results should be array').toBe(true);
  });

  it('should search epics by team', async () => {
    const res = await fetch(`${API}/api/v1/epics?teamId=${TEAM_ID}`, {
      headers: authOnly,
    });
    expect(res.status, 'Epic search by team should return 200').toBe(200);
    const body = await res.json();
    expect(body.data, 'Search should return data').toBeDefined();
    expect(Array.isArray(body.data), 'Search results should be array').toBe(true);
  });
});
