import fastify from "fastify";
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import settingsRoutes, { _setWebhookUrl } from "../../src/routes/settings";

// Mock the authenticate middleware to pass through
vi.mock("../../src/middleware/authenticate", () => ({
  authenticate: async () => {},
}));

describe("Settings Webhook API", () => {
  let app: ReturnType<typeof fastify>;

  beforeAll(async () => {
    app = fastify();
    await app.register(settingsRoutes);
    await app.ready();
  });

  beforeEach(() => {
    _setWebhookUrl(null);
    delete process.env.SPECTREE_WEBHOOK_URL;
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /webhook", () => {
    it("returns null when no webhook URL is configured", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/webhook",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ url: null });
    });

    it("returns the configured webhook URL", async () => {
      _setWebhookUrl("https://example.com/webhook");

      const response = await app.inject({
        method: "GET",
        url: "/webhook",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ url: "https://example.com/webhook" });
    });
  });

  describe("PUT /webhook", () => {
    it("updates the webhook URL", async () => {
      const response = await app.inject({
        method: "PUT",
        url: "/webhook",
        payload: { url: "https://example.com/hook" },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ url: "https://example.com/hook" });
    });

    it("persists the webhook URL for subsequent GET requests", async () => {
      await app.inject({
        method: "PUT",
        url: "/webhook",
        payload: { url: "https://example.com/persisted" },
      });

      const response = await app.inject({
        method: "GET",
        url: "/webhook",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ url: "https://example.com/persisted" });
    });

    it("sets process.env.SPECTREE_WEBHOOK_URL", async () => {
      await app.inject({
        method: "PUT",
        url: "/webhook",
        payload: { url: "https://example.com/env" },
      });

      expect(process.env.SPECTREE_WEBHOOK_URL).toBe("https://example.com/env");
    });
  });
});
