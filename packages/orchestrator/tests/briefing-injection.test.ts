/**
 * Tests for Briefing Injection (ENG-67)
 *
 * Verifies that the orchestrator fetches and injects epic briefings
 * into agent system prompts for cross-session context.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DispatcherClient,
  type BriefingResponse,
} from "../src/spectree/api-client.js";

// Mock the config module
vi.mock("../src/config/index.js", () => ({
  getApiUrl: () => "http://localhost:3001",
  getConfig: () => ({
    maxConcurrentAgents: 4,
    validation: { enabled: false },
  }),
}));

describe("Briefing Injection (ENG-67)", () => {
  let client: DispatcherClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new DispatcherClient({
      apiUrl: "http://localhost:3001",
      token: "test-token",
    });
  });

  describe("getBriefing", () => {
    it("should fetch a briefing for an epic", async () => {
      const mockBriefing: BriefingResponse = {
        briefing: "# Briefing: Auth Epic\n\nKey decisions...",
        tokenCount: 150,
        sources: ["decisions", "patterns"],
      };

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ data: mockBriefing }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const result = await client.getBriefing("epic-123");

      expect(result).toEqual(mockBriefing);
      expect(fetchSpy).toHaveBeenCalledWith(
        "http://localhost:3001/api/v1/epics/epic-123/briefing",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
          }),
        })
      );

      fetchSpy.mockRestore();
    });

    it("should return null on error without throwing", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      );

      const result = await client.getBriefing("nonexistent");

      expect(result).toBeNull();

      fetchSpy.mockRestore();
    });

    it("should return null on network error without throwing", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
        new TypeError("Failed to fetch")
      );

      const result = await client.getBriefing("epic-123");

      expect(result).toBeNull();

      fetchSpy.mockRestore();
    });
  });
});
