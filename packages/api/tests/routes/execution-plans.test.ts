import fastify from "fastify";
import executionPlansRoutes from "../../src/routes/execution-plans";
import * as executionPlanService from "../../src/services/execution-plan";
import { expect, describe, it, vi, beforeAll } from "vitest";

// Mock authentication middleware to bypass auth in tests
vi.mock("../../src/middleware/authenticate.js", () => ({
  authenticate: (_req: any, _res: any, done: any) => done(),
}));

const app = fastify();
app.register(executionPlansRoutes);

vi.mock("../../src/services/execution-plan");

describe("GET /api/v1/execution-plans", () => {
  beforeAll(() => {
    vi.resetAllMocks();
  });

  it("returns execution plan with phases", async () => {
    (executionPlanService.getExecutionPlan as any).mockResolvedValue({
      epicId: "epic-1",
      phases: [
        {
          phaseKey: "1|_",
          items: [
            {
              id: "task-1",
              title: "Task 1",
              featureId: "feature-1",
              featureTitle: "Feature 1",
              executionOrder: 1,
              canParallelize: false,
              parallelGroup: null,
              dependencies: [],
            },
          ],
        },
      ],
    });
    const response = await app.inject({
      method: "GET",
      url: "/?epicId=epic-1",
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.epicId).toBe("epic-1");
    expect(body.data.phases).toHaveLength(1);
    expect(body.data.phases[0].items[0].title).toBe("Task 1");
  });
});
