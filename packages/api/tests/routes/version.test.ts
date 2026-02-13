import fastify from "fastify";
import versionRoutes from "../../src/routes/version";
import { expect, describe, it, beforeAll } from "vitest";

describe("GET /api/v1/version", () => {
  let app: any;

  beforeAll(async () => {
    app = fastify();
    await app.register(versionRoutes);
  });

  it("returns 200 status code", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/",
    });
    expect(response.statusCode).toBe(200);
  });

  it("returns JSON response with version and timestamp fields", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/",
    });
    const body = response.json();
    expect(body).toHaveProperty("version");
    expect(body).toHaveProperty("timestamp");
  });

  it("returns version matching package.json format (semver)", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/",
    });
    const body = response.json();
    // Version should be a string (either valid semver or "unknown")
    expect(typeof body.version).toBe("string");
    expect(body.version).toBeTruthy();
    // Check if it's either valid semver or "unknown"
    const semverRegex = /^\d+\.\d+\.\d+/;
    expect(
      semverRegex.test(body.version) || body.version === "unknown"
    ).toBe(true);
  });

  it("returns valid ISO 8601 timestamp", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/",
    });
    const body = response.json();
    // Check if timestamp is a valid ISO 8601 string
    const timestamp = new Date(body.timestamp);
    expect(timestamp).toBeInstanceOf(Date);
    expect(timestamp.toISOString()).toBe(body.timestamp);
  });

  it("timestamp is recent (within last few seconds)", async () => {
    const beforeRequest = new Date();
    const response = await app.inject({
      method: "GET",
      url: "/",
    });
    const afterRequest = new Date();
    const body = response.json();
    const responseTime = new Date(body.timestamp);
    
    // Response timestamp should be between before and after request
    expect(responseTime.getTime()).toBeGreaterThanOrEqual(beforeRequest.getTime());
    expect(responseTime.getTime()).toBeLessThanOrEqual(afterRequest.getTime());
  });
});
