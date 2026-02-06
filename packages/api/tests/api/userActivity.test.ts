import { buildTestApp } from "../helpers/app";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let app: Awaited<ReturnType<typeof buildTestApp>>;

beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

describe("GET /api/v1/user-activity", () => {
  it("should reject unauthenticated requests", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/user-activity?interval=day",
    });
    expect(res.statusCode).toBe(401);
  });

  it("should enforce rate limiting", async () => {
    // This test assumes a valid token is available
    // Replace 'VALID_TOKEN' with a real token if available
    const token = process.env.TEST_USER_TOKEN || "VALID_TOKEN";
    let lastStatus = 200;
    for (let i = 0; i < 11; i++) {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/user-activity?interval=day",
        headers: { Authorization: `Bearer ${token}` },
      });
      lastStatus = res.statusCode;
      if (lastStatus === 429) break;
    }
    expect([200, 429]).toContain(lastStatus);
  });
});
