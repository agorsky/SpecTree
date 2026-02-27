import { describe, it, expect } from 'vitest';
import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  isMcpRequest,
  validateMcpFeatureCreation,
  validateMcpTaskCreation,
} from '../../src/middleware/mcpValidation.js';
import { ValidationError } from '../../src/errors/index.js';

// Helper to create mock request
function createMockRequest(
  headers: Record<string, string | string[] | undefined> = {},
  body?: Record<string, unknown>
): FastifyRequest {
  return {
    headers,
    body,
  } as unknown as FastifyRequest;
}

// Helper to create mock reply
function createMockReply(): FastifyReply {
  return {} as FastifyReply;
}

describe('mcpValidation middleware', () => {
  describe('isMcpRequest', () => {
    it('should return true when X-MCP-Request header is "true"', () => {
      const request = createMockRequest({ 'x-mcp-request': 'true' });
      expect(isMcpRequest(request)).toBe(true);
    });

    it('should return true when X-MCP-Request header is "1"', () => {
      const request = createMockRequest({ 'x-mcp-request': '1' });
      expect(isMcpRequest(request)).toBe(true);
    });

    it('should return false when X-MCP-Request header is absent', () => {
      const request = createMockRequest({});
      expect(isMcpRequest(request)).toBe(false);
    });

    it('should return false when X-MCP-Request header is "false"', () => {
      const request = createMockRequest({ 'x-mcp-request': 'false' });
      expect(isMcpRequest(request)).toBe(false);
    });

    it('should return false when X-MCP-Request header is some other value', () => {
      const request = createMockRequest({ 'x-mcp-request': 'yes' });
      expect(isMcpRequest(request)).toBe(false);
    });
  });

  describe('validateMcpFeatureCreation', () => {
    const reply = createMockReply();

    describe('non-MCP requests', () => {
      it('should pass validation for non-MCP request without executionOrder', async () => {
        const request = createMockRequest({}, {
          title: 'Test Feature',
          epicId: 'epic-123',
        });

        await expect(validateMcpFeatureCreation(request, reply)).resolves.toBeUndefined();
      });

      it('should pass validation for non-MCP request without estimatedComplexity', async () => {
        const request = createMockRequest({}, {
          title: 'Test Feature',
          epicId: 'epic-123',
        });

        await expect(validateMcpFeatureCreation(request, reply)).resolves.toBeUndefined();
      });
    });

    describe('MCP requests - executionOrder validation', () => {
      it('should fail when executionOrder is missing', async () => {
        const request = createMockRequest({ 'x-mcp-request': 'true' }, {
          title: 'Test Feature',
          epicId: 'epic-123',
          estimatedComplexity: 'moderate',
        });

        await expect(validateMcpFeatureCreation(request, reply)).rejects.toThrow(ValidationError);
        await expect(validateMcpFeatureCreation(request, reply)).rejects.toThrow(/executionOrder is required/);
      });

      it('should fail when executionOrder is null', async () => {
        const request = createMockRequest({ 'x-mcp-request': 'true' }, {
          title: 'Test Feature',
          epicId: 'epic-123',
          executionOrder: null,
          estimatedComplexity: 'moderate',
        });

        await expect(validateMcpFeatureCreation(request, reply)).rejects.toThrow(ValidationError);
      });

      it('should fail when executionOrder is not a number', async () => {
        const request = createMockRequest({ 'x-mcp-request': 'true' }, {
          title: 'Test Feature',
          epicId: 'epic-123',
          executionOrder: 'first',
          estimatedComplexity: 'moderate',
        });

        await expect(validateMcpFeatureCreation(request, reply)).rejects.toThrow(ValidationError);
        await expect(validateMcpFeatureCreation(request, reply)).rejects.toThrow(/must be a positive integer/);
      });

      it('should fail when executionOrder is not an integer', async () => {
        const request = createMockRequest({ 'x-mcp-request': 'true' }, {
          title: 'Test Feature',
          epicId: 'epic-123',
          executionOrder: 1.5,
          estimatedComplexity: 'moderate',
        });

        await expect(validateMcpFeatureCreation(request, reply)).rejects.toThrow(ValidationError);
      });

      it('should fail when executionOrder is zero', async () => {
        const request = createMockRequest({ 'x-mcp-request': 'true' }, {
          title: 'Test Feature',
          epicId: 'epic-123',
          executionOrder: 0,
          estimatedComplexity: 'moderate',
        });

        await expect(validateMcpFeatureCreation(request, reply)).rejects.toThrow(ValidationError);
      });

      it('should fail when executionOrder is negative', async () => {
        const request = createMockRequest({ 'x-mcp-request': 'true' }, {
          title: 'Test Feature',
          epicId: 'epic-123',
          executionOrder: -1,
          estimatedComplexity: 'moderate',
        });

        await expect(validateMcpFeatureCreation(request, reply)).rejects.toThrow(ValidationError);
      });
    });

    describe('MCP requests - estimatedComplexity validation', () => {
      it('should fail when estimatedComplexity is missing', async () => {
        const request = createMockRequest({ 'x-mcp-request': 'true' }, {
          title: 'Test Feature',
          epicId: 'epic-123',
          executionOrder: 1,
        });

        await expect(validateMcpFeatureCreation(request, reply)).rejects.toThrow(ValidationError);
        await expect(validateMcpFeatureCreation(request, reply)).rejects.toThrow(/estimatedComplexity is required/);
      });

      it('should fail when estimatedComplexity is null', async () => {
        const request = createMockRequest({ 'x-mcp-request': 'true' }, {
          title: 'Test Feature',
          epicId: 'epic-123',
          executionOrder: 1,
          estimatedComplexity: null,
        });

        await expect(validateMcpFeatureCreation(request, reply)).rejects.toThrow(ValidationError);
      });

      it('should fail when estimatedComplexity is not a valid value', async () => {
        const request = createMockRequest({ 'x-mcp-request': 'true' }, {
          title: 'Test Feature',
          epicId: 'epic-123',
          executionOrder: 1,
          estimatedComplexity: 'very-hard',
        });

        await expect(validateMcpFeatureCreation(request, reply)).rejects.toThrow(ValidationError);
        await expect(validateMcpFeatureCreation(request, reply)).rejects.toThrow(/must be one of/);
      });
    });

    describe('MCP requests - successful validation', () => {
      it('should pass with valid executionOrder and estimatedComplexity: trivial', async () => {
        const request = createMockRequest({ 'x-mcp-request': 'true' }, {
          title: 'Test Feature',
          epicId: 'epic-123',
          executionOrder: 1,
          estimatedComplexity: 'trivial',
        });

        await expect(validateMcpFeatureCreation(request, reply)).resolves.toBeUndefined();
      });

      it('should pass with valid executionOrder and estimatedComplexity: simple', async () => {
        const request = createMockRequest({ 'x-mcp-request': 'true' }, {
          title: 'Test Feature',
          epicId: 'epic-123',
          executionOrder: 2,
          estimatedComplexity: 'simple',
        });

        await expect(validateMcpFeatureCreation(request, reply)).resolves.toBeUndefined();
      });

      it('should pass with valid executionOrder and estimatedComplexity: moderate', async () => {
        const request = createMockRequest({ 'x-mcp-request': 'true' }, {
          title: 'Test Feature',
          epicId: 'epic-123',
          executionOrder: 3,
          estimatedComplexity: 'moderate',
        });

        await expect(validateMcpFeatureCreation(request, reply)).resolves.toBeUndefined();
      });

      it('should pass with valid executionOrder and estimatedComplexity: complex', async () => {
        const request = createMockRequest({ 'x-mcp-request': 'true' }, {
          title: 'Test Feature',
          epicId: 'epic-123',
          executionOrder: 10,
          estimatedComplexity: 'complex',
        });

        await expect(validateMcpFeatureCreation(request, reply)).resolves.toBeUndefined();
      });
    });

    describe('error response format', () => {
      it('should include field name in error details', async () => {
        const request = createMockRequest({ 'x-mcp-request': 'true' }, {
          title: 'Test Feature',
          epicId: 'epic-123',
          estimatedComplexity: 'moderate',
        });

        try {
          await validateMcpFeatureCreation(request, reply);
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          const validationError = error as ValidationError;
          expect(validationError.details).toBeDefined();
          expect(validationError.details?.mcpValidation).toBeDefined();
          expect(validationError.details?.mcpValidation.field).toBe('executionOrder');
          expect(validationError.details?.mcpValidation.suggestion).toBeDefined();
        }
      });
    });
  });

  describe('validateMcpTaskCreation', () => {
    const reply = createMockReply();

    describe('non-MCP requests', () => {
      it('should pass validation for non-MCP request without executionOrder', async () => {
        const request = createMockRequest({}, {
          title: 'Test Task',
          featureId: 'feature-123',
        });

        await expect(validateMcpTaskCreation(request, reply)).resolves.toBeUndefined();
      });
    });

    describe('MCP requests - executionOrder validation', () => {
      it('should fail when executionOrder is missing', async () => {
        const request = createMockRequest({ 'x-mcp-request': 'true' }, {
          title: 'Test Task',
          featureId: 'feature-123',
        });

        await expect(validateMcpTaskCreation(request, reply)).rejects.toThrow(ValidationError);
        await expect(validateMcpTaskCreation(request, reply)).rejects.toThrow(/executionOrder is required/);
      });

      it('should fail when executionOrder is null', async () => {
        const request = createMockRequest({ 'x-mcp-request': 'true' }, {
          title: 'Test Task',
          featureId: 'feature-123',
          executionOrder: null,
        });

        await expect(validateMcpTaskCreation(request, reply)).rejects.toThrow(ValidationError);
      });

      it('should fail when executionOrder is not a number', async () => {
        const request = createMockRequest({ 'x-mcp-request': 'true' }, {
          title: 'Test Task',
          featureId: 'feature-123',
          executionOrder: 'first',
        });

        await expect(validateMcpTaskCreation(request, reply)).rejects.toThrow(ValidationError);
      });

      it('should fail when executionOrder is zero or negative', async () => {
        const request = createMockRequest({ 'x-mcp-request': 'true' }, {
          title: 'Test Task',
          featureId: 'feature-123',
          executionOrder: 0,
        });

        await expect(validateMcpTaskCreation(request, reply)).rejects.toThrow(ValidationError);
      });
    });

    describe('MCP requests - successful validation', () => {
      it('should pass with valid executionOrder', async () => {
        const request = createMockRequest({ 'x-mcp-request': 'true' }, {
          title: 'Test Task',
          featureId: 'feature-123',
          executionOrder: 1,
        });

        await expect(validateMcpTaskCreation(request, reply)).resolves.toBeUndefined();
      });

      it('should pass with higher executionOrder values', async () => {
        const request = createMockRequest({ 'x-mcp-request': 'true' }, {
          title: 'Test Task',
          featureId: 'feature-123',
          executionOrder: 100,
        });

        await expect(validateMcpTaskCreation(request, reply)).resolves.toBeUndefined();
      });
    });

    describe('error response format', () => {
      it('should include field name and suggestion in error details', async () => {
        const request = createMockRequest({ 'x-mcp-request': 'true' }, {
          title: 'Test Task',
          featureId: 'feature-123',
        });

        try {
          await validateMcpTaskCreation(request, reply);
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          const validationError = error as ValidationError;
          expect(validationError.details?.mcpValidation).toBeDefined();
          expect(validationError.details?.mcpValidation.error).toBe('mcp_validation_failed');
          expect(validationError.details?.mcpValidation.field).toBe('executionOrder');
          expect(validationError.details?.mcpValidation.suggestion).toContain('executionOrder');
        }
      });
    });
  });
});
