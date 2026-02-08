/**
 * Tests for composite-builder utilities
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  buildCompositeSchema,
  routeAction,
  formatCompositeResponse,
  formatCompositeListResponse,
  buildActionDescription,
  hasAction,
  getAction,
  type ActionDefinition,
} from "../../src/tools/utils/composite-builder.js";

describe("composite-builder", () => {
  describe("buildCompositeSchema", () => {
    it("creates a discriminated union from action definitions", () => {
      const actions: [ActionDefinition<any>, ActionDefinition<any>] = [
        {
          action: "create",
          schema: z.object({
            name: z.string(),
          }),
          description: "Create a new item",
        },
        {
          action: "delete",
          schema: z.object({
            id: z.string(),
          }),
          description: "Delete an item",
        },
      ];

      const schema = buildCompositeSchema(actions);

      // Test valid create action
      const createResult = schema.parse({
        action: "create",
        name: "Test",
      });
      expect(createResult).toEqual({
        action: "create",
        name: "Test",
      });

      // Test valid delete action
      const deleteResult = schema.parse({
        action: "delete",
        id: "123",
      });
      expect(deleteResult).toEqual({
        action: "delete",
        id: "123",
      });
    });

    it("validates parameters per action", () => {
      const actions: [ActionDefinition<any>, ActionDefinition<any>] = [
        {
          action: "create",
          schema: z.object({
            name: z.string(),
          }),
          description: "Create",
        },
        {
          action: "update",
          schema: z.object({
            id: z.string(),
            name: z.string().optional(),
          }),
          description: "Update",
        },
      ];

      const schema = buildCompositeSchema(actions);

      // Create requires name
      expect(() =>
        schema.parse({
          action: "create",
        })
      ).toThrow();

      // Update requires id
      expect(() =>
        schema.parse({
          action: "update",
          name: "Test",
        })
      ).toThrow();

      // Valid update with just id
      const result = schema.parse({
        action: "update",
        id: "123",
      });
      expect(result.id).toBe("123");
    });

    it("rejects unknown actions", () => {
      const actions: [ActionDefinition<any>] = [
        {
          action: "create",
          schema: z.object({
            name: z.string(),
          }),
          description: "Create",
        },
      ];

      const schema = buildCompositeSchema(actions);

      expect(() =>
        schema.parse({
          action: "invalid",
          name: "Test",
        })
      ).toThrow();
    });
  });

  describe("routeAction", () => {
    it("routes to the correct handler", async () => {
      const handlers = {
        create: async (input: { action: string; name: string }) => ({
          result: "created",
          name: input.name,
        }),
        delete: async (input: { action: string; id: string }) => ({
          result: "deleted",
          id: input.id,
        }),
      };

      const createResult = await routeAction(
        "create",
        handlers,
        { action: "create", name: "Test" }
      );
      expect(createResult).toEqual({ result: "created", name: "Test" });

      const deleteResult = await routeAction(
        "delete",
        handlers,
        { action: "delete", id: "123" }
      );
      expect(deleteResult).toEqual({ result: "deleted", id: "123" });
    });

    it("throws for unknown actions", async () => {
      const handlers = {
        create: async () => ({ result: "created" }),
      };

      await expect(
        routeAction("invalid", handlers, { action: "invalid" })
      ).rejects.toThrow("Unknown action: 'invalid'");
    });

    it("propagates handler errors", async () => {
      const handlers = {
        create: async () => {
          throw new Error("Handler error");
        },
      };

      await expect(
        routeAction("create", handlers, { action: "create" })
      ).rejects.toThrow("Handler error");
    });

    it("works with synchronous handlers", async () => {
      const handlers = {
        create: (input: { action: string; name: string }) => ({
          result: "created",
          name: input.name,
        }),
      };

      const result = await routeAction(
        "create",
        handlers,
        { action: "create", name: "Test" }
      );
      expect(result).toEqual({ result: "created", name: "Test" });
    });
  });

  describe("formatCompositeResponse", () => {
    it("formats a basic success response", () => {
      const response = formatCompositeResponse({
        message: "Operation successful",
      });

      expect(response).toEqual({
        success: true,
        message: "Operation successful",
      });
    });

    it("includes data when provided", () => {
      const response = formatCompositeResponse({
        message: "Item created",
        data: { id: "123", name: "Test" },
      });

      expect(response).toEqual({
        success: true,
        message: "Item created",
        data: { id: "123", name: "Test" },
      });
    });

    it("includes metadata when provided", () => {
      const response = formatCompositeResponse({
        message: "Operation successful",
        meta: { requestId: "abc-123", duration: 150 },
      });

      expect(response).toEqual({
        success: true,
        message: "Operation successful",
        meta: { requestId: "abc-123", duration: 150 },
      });
    });

    it("includes both data and metadata", () => {
      const response = formatCompositeResponse({
        message: "Item created",
        data: { id: "123" },
        meta: { requestId: "abc-123" },
      });

      expect(response).toEqual({
        success: true,
        message: "Item created",
        data: { id: "123" },
        meta: { requestId: "abc-123" },
      });
    });
  });

  describe("formatCompositeListResponse", () => {
    it("formats a basic list response", () => {
      const items = [{ id: "1" }, { id: "2" }];
      const response = formatCompositeListResponse({
        message: "Found 2 items",
        items,
      });

      expect(response).toEqual({
        success: true,
        message: "Found 2 items",
        data: items,
      });
    });

    it("includes pagination metadata", () => {
      const items = [{ id: "1" }, { id: "2" }];
      const response = formatCompositeListResponse({
        message: "Found 2 items",
        items,
        total: 10,
        cursor: "next-cursor",
        limit: 2,
      });

      expect(response).toEqual({
        success: true,
        message: "Found 2 items",
        data: items,
        meta: {
          total: 10,
          cursor: "next-cursor",
          limit: 2,
        },
      });
    });

    it("handles null cursor", () => {
      const items = [{ id: "1" }];
      const response = formatCompositeListResponse({
        message: "Found 1 item",
        items,
        cursor: null,
      });

      expect(response).toEqual({
        success: true,
        message: "Found 1 item",
        data: items,
        meta: { cursor: null },
      });
    });
  });

  describe("buildActionDescription", () => {
    it("builds a formatted description with action list", () => {
      const description = buildActionDescription(
        "Manage projects with action-based routing.",
        [
          { action: "create", description: "Create a new project" },
          { action: "update", description: "Update an existing project" },
          { action: "delete", description: "Delete a project" },
        ]
      );

      expect(description).toContain("Manage projects with action-based routing.");
      expect(description).toContain("- 'create': Create a new project");
      expect(description).toContain("- 'update': Update an existing project");
      expect(description).toContain("- 'delete': Delete a project");
      expect(description).toContain("Use the 'action' parameter");
    });

    it("handles single action", () => {
      const description = buildActionDescription("Simple tool", [
        { action: "execute", description: "Execute the action" },
      ]);

      expect(description).toContain("Simple tool");
      expect(description).toContain("- 'execute': Execute the action");
    });
  });

  describe("hasAction", () => {
    it("returns true for objects with action property", () => {
      expect(hasAction({ action: "test" })).toBe(true);
      expect(hasAction({ action: "test", other: "prop" })).toBe(true);
    });

    it("returns false for objects without action property", () => {
      expect(hasAction({})).toBe(false);
      expect(hasAction({ name: "test" })).toBe(false);
    });

    it("returns false for non-objects", () => {
      expect(hasAction(null)).toBe(false);
      expect(hasAction(undefined)).toBe(false);
      expect(hasAction("string")).toBe(false);
      expect(hasAction(123)).toBe(false);
    });

    it("returns false for objects with non-string action", () => {
      expect(hasAction({ action: 123 })).toBe(false);
      expect(hasAction({ action: null })).toBe(false);
      expect(hasAction({ action: {} })).toBe(false);
    });
  });

  describe("getAction", () => {
    it("extracts action from input", () => {
      const input = { action: "create", name: "Test" };
      expect(getAction(input)).toBe("create");
    });

    it("works with different action values", () => {
      expect(getAction({ action: "update", id: "123" })).toBe("update");
      expect(getAction({ action: "delete", id: "123" })).toBe("delete");
    });
  });

  describe("integration: full workflow", () => {
    it("builds and uses a complete composite tool pattern", async () => {
      // 1. Define actions
      const actions: [
        ActionDefinition<any>,
        ActionDefinition<any>,
        ActionDefinition<any>
      ] = [
        {
          action: "create",
          schema: z.object({
            name: z.string(),
            description: z.string().optional(),
          }),
          description: "Create a new project",
        },
        {
          action: "update",
          schema: z.object({
            id: z.string(),
            name: z.string().optional(),
          }),
          description: "Update a project",
        },
        {
          action: "delete",
          schema: z.object({
            id: z.string(),
          }),
          description: "Delete a project",
        },
      ];

      // 2. Build schema
      const schema = buildCompositeSchema(actions);

      // 3. Build description
      const description = buildActionDescription(
        "Manage projects",
        actions
      );
      expect(description).toContain("Manage projects");

      // 4. Define handlers
      const mockDb: Record<string, any> = {};
      const handlers = {
        create: async (input: { action: string; name: string; description?: string }) => {
          const id = Math.random().toString();
          mockDb[id] = { id, name: input.name, description: input.description };
          return formatCompositeResponse({
            message: "Project created",
            data: mockDb[id],
          });
        },
        update: async (input: { action: string; id: string; name?: string }) => {
          if (!mockDb[input.id]) {
            throw new Error("Not found");
          }
          if (input.name) {
            mockDb[input.id].name = input.name;
          }
          return formatCompositeResponse({
            message: "Project updated",
            data: mockDb[input.id],
          });
        },
        delete: async (input: { action: string; id: string }) => {
          delete mockDb[input.id];
          return formatCompositeResponse({
            message: "Project deleted",
          });
        },
      };

      // 5. Use the tool
      const createInput = schema.parse({
        action: "create",
        name: "Test Project",
      });
      const createResult = await routeAction(
        createInput.action,
        handlers,
        createInput
      );
      expect(createResult.success).toBe(true);
      expect(createResult.data.name).toBe("Test Project");

      const projectId = createResult.data.id;

      const updateInput = schema.parse({
        action: "update",
        id: projectId,
        name: "Updated Project",
      });
      const updateResult = await routeAction(
        updateInput.action,
        handlers,
        updateInput
      );
      expect(updateResult.success).toBe(true);
      expect(updateResult.data.name).toBe("Updated Project");

      const deleteInput = schema.parse({
        action: "delete",
        id: projectId,
      });
      const deleteResult = await routeAction(
        deleteInput.action,
        handlers,
        deleteInput
      );
      expect(deleteResult.success).toBe(true);
    });
  });
});
