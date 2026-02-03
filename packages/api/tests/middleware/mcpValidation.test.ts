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
      it('should pass validation for non-MCP request without executionOrder', () => {
        const request = createMockRequest({}, {
          title: 'Test Feature',
          epicId: 'epic-123',
        });

        expect(() => validateMcpFeatureCreation(request, reply)).not.toThrow();
      });

      it('should pass validation for non-MCP request without estimatedComplexity', () => {
        const request = createMockRequest({}, {
          title: 'Test Feature',
          epicId: 'epic-123',
        });

        expect(() => validateMcpFeatureCreation(request, reply)).not.toThrow();
      });
    });

    describe('MCP requests - executionOrder validation', () => {
      it('should fail when executionOrder is missing', () => {
        const request = createMockRequest({ 'x-mcp-request': 'true' }, {
          title: 'Test Feature',
          epicId: 'epic-123',
          estimatedComplexity: 'moderate',
        });

        expect(() => validateMcpFeatureCreation(request, reply)).toThrow(ValidationError);
        try {
          validateMcpFeatureCreation(request, reply);
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          const validationError = error as ValidationError;
          expect(validationError.message).toContain('executionOrder is required');
        }
      });

      it('should fail when executionOrder is null', () => {
        const request = createMockRequest({ 'x-mcp-request': 'true' }, {
          title: 'Test Feature',
          epicId: 'epic-123',
          executionOrder: null,
          estimatedComplexity: 'moderate',
        });

        expect(() => validateMcpFeatureCreation(request, reply)).toThrow(ValidationError);
      });

      it('should fail when executionOrder is not a number', () => {
        const request = createMockRequest({ 'x-mcp-request': 'true' }, {
          title: 'Test Feature',
          epicId: 'epic-123',
          executionOrder: 'first',
          estimatedComplexity: 'moderate',
        });

        expect(() => validateMcpFeatureCreation(request, reply)).toThrow(ValidationError);
        try {
          validateMcpFeatureCreation(request, reply);
        } catch (error) {
          expect((error as ValidationError).message).toContain('must be a positive integer');
        }
      });

      it('should fail when executionOrder is not an integer', () => {
        const request = createMockRequest({ 'x-mcp-request': 'true' }, {
          title: 'Test Feature',
          epicId: 'epic-123',
          executionOrder: 1.5,
          estimatedComplexity: 'moderate',
        });

        expect(() => validateMcpFeatureCreation(request, reply)).toThrow(ValidationError);
      });

      it('should fail when executionOrder is zero', () => {
        const request = createMockRequest({ 'x-mcp-request': 'true' }, {
          title: 'Test Feature',
          epicId: 'epic-123',
          executionOrder: 0,
          estimatedComplexity: 'moderate',
        });

        expect(() => validateMcpFeatureCreation(request, reply)).toThrow(ValidationError);
      });

      it('should fail when executionOrder is negative', () => {
        const request = createMockRequest({ 'x-mcp-request': 'true' }, {
          title: 'Test Feature',
          epicId: 'epic-123',
          executionOrder: -1,
          estimatedComplexity: 'moderate',
        });

        expect(() => validateMcpFeatureCreation(request, reply)).toThrow(ValidationError);
      });
    });

    describe('MCP requests - estimatedComplexity validation', () => {
      it('should fail when estimatedComplexity is missing', () => {
        const request = createMockRequest({ 'x-mcp-request': 'true' }, {
          title: 'Test Feature',
          epicId: 'epic-123',
          executionOrder: 1,
        });

        expect(() => validateMcpFeatureCreation(request, reply)).toThrow(ValidationError);
        try {
          validateMcpFeatureCreation(request, reply);
        } catch (error) {
          expect((error as ValidationError).message).toContain('estimatedComplexity is required');
        }
      });

      it('should fail when estimatedComplexity is null', () => {
        const request = createMockRequest({ 'x-mcp-request': 'true' }, {
          title: 'Test Feature',
          epicId: 'epic-123',
          executionOrder: 1,
          estimatedComplexity: null,
        });

        expect(() => validateMcpFeatureCreation(request, reply)).toThrow(ValidationError);
      });

      it('should fail when estimatedComplexity is not a valid value', () => {
        const request = createMockRequest({ 'x-mcp-request': 'true' }, {
          title: 'Test Feature',
          epicId: 'epic-123',
          executionOrder: 1,
          estimatedComplexity: 'very-hard',
        });

        expect(() => validateMcpFeatureCreation(request, reply)).toThrow(ValidationError);
        try {
          validateMcpFeatureCreation(request, reply);
        } catch (error) {
          expect((error as ValidationError).message).toContain('must be one of');
        }
      });
    });

    describe('MCP requests - successful validation', () => {
      it('should pass with valid executionOrder and estimatedComplexity: trivial', () => {
        const request = createMockRequest({ 'x-mcp-request': 'true' }, {
          title: 'Test Feature',
          epicId: 'epic-123',
          executionOrder: 1,
          estimatedComplexity: 'trivial',
        });

        expect(() => validateMcpFeatureCreation(request, reply)).not.toThrow();
      });

      it('should pass with valid executionOrder and estimatedComplexity: simple', () => {
        const request = createMockRequest({ 'x-mcp-request': 'true' }, {
          title: 'Test Feature',
          epicId: 'epic-123',
          executionOrder: 2,
          estimatedComplexity: 'simple',
        });

        expect(() => validateMcpFeatureCreation(request, reply)).not.toThrow();
      });

      it('should pass with valid executionOrder and estimatedComplexity: moderate', () => {
        const request = createMockRequest({ 'x-mcp-request': 'true' }, {
          title: 'Test Feature',
          epicId: 'epic-123',
          executionOrder: 3,
          estimatedComplexity: 'moderate',
        });

        expect(() => validateMcpFeatureCreation(request, reply)).not.toThrow();
      });

      it('should pass with valid executionOrder and estimatedComplexity: complex', () => {
        const request = createMockRequest({ 'x-mcp-request': 'true' }, {
          title: 'Test Feature',
          epicId: 'epic-123',
          executionOrder: 10,
          estimatedComplexity: 'complex',
        });

        expect(() => validateMcpFeatureCreation(request, reply)).not.toThrow();
      });
    });

    describe('error response format', () => {
      it('should include field name in error details', () => {
        const request = createMockRequest({ 'x-mcp-request': 'true' }, {
          title: 'Test Feature',
          epicId: 'epic-123',
          estimatedComplexity: 'moderate',
        });

        try {
          validateMcpFeatureCreation(request, reply);
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
      it('should pass validation for non-MCP request without executionOrder', () => {
        const request = createMockRequest({}, {
          title: 'Test Task',
          featureId: 'feature-123',
        });

        expect(() => validateMcpTaskCreation(request, reply)).not.toThrow();
      });
    });

    describe('MCP requests - executionOrder validation', () => {
      it('should fail when executionOrder is missing', () => {
        const request = createMockRequest({ 'x-mcp-request': 'true' }, {
          title: 'Test Task',
          featureId: 'feature-123',
        });

        expect(() => validateMcpTaskCreation(request, reply)).toThrow(ValidationError);
        try {
          validateMcpTaskCreation(request, reply);
        } catch (error) {
          expect((error as ValidationError).message).toContain('executionOrder is required');
        }
      });

      it('should fail when executionOrder is null', () => {
        const request = createMockRequest({ 'x-mcp-request': 'true' }, {
          title: 'Test Task',
          featureId: 'feature-123',
          executionOrder: null,
        });

        expect(() => validateMcpTaskCreation(request, reply)).toThrow(ValidationError);
      });

      it('should fail when executionOrder is not a number', () => {
        const request = createMockRequest({ 'x-mcp-request': 'true' }, {
          title: 'Test Task',
          featureId: 'feature-123',
          executionOrder: 'first',
        });

        expect(() => validateMcpTaskCreation(request, reply)).toThrow(ValidationError);
      });

      it('should fail when executionOrder is zero or negative', () => {
        const request = createMockRequest({ 'x-mcp-request': 'true' }, {
          title: 'Test Task',
          featureId: 'feature-123',
          executionOrder: 0,
        });

        expect(() => validateMcpTaskCreation(request, reply)).toThrow(ValidationError);
      });
    });

    describe('MCP requests - successful validation', () => {
      it('should pass with valid executionOrder', () => {
        const request = createMockRequest({ 'x-mcp-request': 'true' }, {
          title: 'Test Task',
          featureId: 'feature-123',
          executionOrder: 1,
        });

        expect(() => validateMcpTaskCreation(request, reply)).not.toThrow();
      });

      it('should pass with higher executionOrder values', () => {
        const request = createMockRequest({ 'x-mcp-request': 'true' }, {
          title: 'Test Task',
          featureId: 'feature-123',
          executionOrder: 100,
        });

        expect(() => validateMcpTaskCreation(request, reply)).not.toThrow();
      });
    });

    describe('error response format', () => {
      it('should include field name and suggestion in error details', () => {
        const request = createMockRequest({ 'x-mcp-request': 'true' }, {
          title: 'Test Task',
          featureId: 'feature-123',
        });

        try {
          validateMcpTaskCreation(request, reply);
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
