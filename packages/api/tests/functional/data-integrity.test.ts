/**
 * ENG-89: Data Integrity Validation
 *
 * Tests REAL HTTP requests against localhost:3001.
 * Verifies referential integrity across the database:
 * - No orphaned tasks (every task.featureId resolves)
 * - Epic _count.features matches actual feature list
 * - Case.lawId references resolve for all cases
 */
import { describe, it, expect } from 'vitest';

const API = 'http://localhost:3001';
const AUTH = 'Bearer st_wShsQaYUgKEL9uJosNtLlLx2bqQe0t5tVCN9DxYWIVA';
const authOnly = { Authorization: AUTH };

// Helper to fetch all pages of a paginated endpoint
async function fetchAll<T>(path: string, maxPages = 10): Promise<T[]> {
  const all: T[] = [];
  let cursor: string | null = null;
  let page = 0;

  while (page < maxPages) {
    const url = cursor
      ? `${API}${path}${path.includes('?') ? '&' : '?'}cursor=${cursor}&limit=100`
      : `${API}${path}${path.includes('?') ? '&' : '?'}limit=100`;
    const res = await fetch(url, { headers: authOnly });
    if (res.status !== 200) break;
    const body = await res.json();
    const items = body.data || [];
    all.push(...items);

    // Check for more pages
    const meta = body.meta;
    if (meta?.hasMore && meta.cursor) {
      cursor = meta.cursor;
      page++;
    } else {
      break;
    }
  }

  return all;
}

// ===========================================================================
// ENG-89-1: No Orphaned Tasks
// ===========================================================================
describe('ENG-89-1: No Orphaned Tasks', () => {
  it('every task.featureId should resolve to an existing feature', async () => {
    const tasks = await fetchAll<{ id: string; featureId: string; title: string }>('/api/v1/tasks');
    if (tasks.length === 0) {
      // No tasks in the system, test passes trivially
      return;
    }

    // Collect unique featureIds from tasks
    const featureIds = [...new Set(tasks.map((t) => t.featureId))];
    const orphanedTasks: { taskId: string; featureId: string; title: string }[] = [];

    // Verify each featureId resolves
    for (const featureId of featureIds) {
      const res = await fetch(`${API}/api/v1/features/${featureId}`, {
        headers: authOnly,
      });
      if (res.status === 404 || res.status === 403) {
        const orphaned = tasks.filter((t) => t.featureId === featureId);
        orphanedTasks.push(
          ...orphaned.map((t) => ({
            taskId: t.id,
            featureId: t.featureId,
            title: t.title,
          }))
        );
      }
    }

    expect(
      orphanedTasks.length,
      `Found ${orphanedTasks.length} orphaned tasks: ${JSON.stringify(orphanedTasks.slice(0, 5))}`
    ).toBe(0);
  });
});

// ===========================================================================
// ENG-89-2: Epic Feature Count Matches
// ===========================================================================
describe('ENG-89-2: Epic Feature Count Consistency', () => {
  it('epic _count.features should match actual feature list for all epics', async () => {
    const epics = await fetchAll<{
      id: string;
      name: string;
      _count?: { features: number };
    }>('/api/v1/epics?includeArchived=true');

    if (epics.length === 0) return;

    const mismatches: { epicId: string; epicName: string; expected: number; actual: number }[] = [];

    for (const epic of epics) {
      // Get actual features for this epic
      const featuresRes = await fetch(
        `${API}/api/v1/features?epicId=${epic.id}&limit=100`,
        { headers: authOnly }
      );
      if (featuresRes.status !== 200) continue;
      const featuresBody = await featuresRes.json();
      const actualCount = featuresBody.data?.length ?? 0;

      // If epic has _count, verify it
      if (epic._count?.features !== undefined) {
        if (epic._count.features !== actualCount) {
          mismatches.push({
            epicId: epic.id,
            epicName: epic.name,
            expected: epic._count.features,
            actual: actualCount,
          });
        }
      }
    }

    expect(
      mismatches.length,
      `Found ${mismatches.length} feature count mismatches: ${JSON.stringify(mismatches.slice(0, 5))}`
    ).toBe(0);
  });
});

// ===========================================================================
// ENG-89-3: Case lawId References Resolve
// ===========================================================================
describe('ENG-89-3: Case lawId References', () => {
  it('every case.lawId should reference an existing law', async () => {
    const cases = await fetchAll<{
      id: string;
      lawId: string;
      accusedAgent: string;
    }>('/api/v1/cases');

    if (cases.length === 0) return;

    // Collect unique lawIds
    const lawIds = [...new Set(cases.map((c) => c.lawId))];
    const brokenRefs: { caseId: string; lawId: string; accusedAgent: string }[] = [];

    for (const lawId of lawIds) {
      const res = await fetch(`${API}/api/v1/laws/${lawId}`, { headers: authOnly });
      if (res.status === 404) {
        const broken = cases.filter((c) => c.lawId === lawId);
        brokenRefs.push(
          ...broken.map((c) => ({
            caseId: c.id,
            lawId: c.lawId,
            accusedAgent: c.accusedAgent,
          }))
        );
      }
    }

    expect(
      brokenRefs.length,
      `Found ${brokenRefs.length} cases with broken lawId references: ${JSON.stringify(brokenRefs.slice(0, 5))}`
    ).toBe(0);
  });
});
