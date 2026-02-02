import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db module
vi.mock('../../src/lib/db.js', () => ({
  prisma: {
    planTemplate: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    team: {
      findUnique: vi.fn(),
    },
    epic: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    feature: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    task: {
      create: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback({
      epic: { create: vi.fn() },
      feature: { create: vi.fn() },
      task: { create: vi.fn() },
    })),
  },
}));

import { prisma } from '../../src/lib/db.js';
import {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  previewTemplate,
  substituteVariables,
  extractVariables,
  extractTemplateVariables,
  parseTemplateStructure,
} from '../../src/services/templateService.js';
import { NotFoundError, ValidationError, ConflictError } from '../../src/errors/index.js';
import type { TemplateStructure } from '../../src/schemas/template.js';

describe('templateService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Variable Substitution Tests
  // ==========================================================================

  describe('substituteVariables', () => {
    it('should replace single variable', () => {
      const result = substituteVariables('Hello {{name}}!', { name: 'World' });
      expect(result).toBe('Hello World!');
    });

    it('should replace multiple variables', () => {
      const result = substituteVariables(
        '{{greeting}} {{name}}, welcome to {{place}}!',
        { greeting: 'Hello', name: 'Alice', place: 'SpecTree' }
      );
      expect(result).toBe('Hello Alice, welcome to SpecTree!');
    });

    it('should keep unmatched variables as-is', () => {
      const result = substituteVariables('Hello {{name}}, {{unknown}}!', { name: 'World' });
      expect(result).toBe('Hello World, {{unknown}}!');
    });

    it('should handle empty variables object', () => {
      const result = substituteVariables('Hello {{name}}!', {});
      expect(result).toBe('Hello {{name}}!');
    });

    it('should handle template with no variables', () => {
      const result = substituteVariables('Hello World!', { name: 'Test' });
      expect(result).toBe('Hello World!');
    });
  });

  describe('extractVariables', () => {
    it('should extract single variable', () => {
      const result = extractVariables('Hello {{name}}!');
      expect(result).toEqual(['name']);
    });

    it('should extract multiple unique variables', () => {
      const result = extractVariables('{{greeting}} {{name}}, {{name}}!');
      expect(result).toEqual(['greeting', 'name']);
    });

    it('should return empty array for no variables', () => {
      const result = extractVariables('Hello World!');
      expect(result).toEqual([]);
    });
  });

  describe('extractTemplateVariables', () => {
    it('should extract variables from entire template structure', () => {
      const structure: TemplateStructure = {
        epicDefaults: {
          descriptionPrompt: 'Implementation of {{topic}}',
        },
        features: [
          {
            titleTemplate: 'Research: {{topic}}',
            descriptionPrompt: 'Research {{technology}} for {{topic}}',
            executionOrder: 1,
            tasks: [
              {
                titleTemplate: 'Review {{topic}} patterns',
                executionOrder: 1,
              },
            ],
          },
        ],
      };

      const result = extractTemplateVariables(structure);
      expect(result).toContain('topic');
      expect(result).toContain('technology');
      // Should be unique
      expect(result.filter(v => v === 'topic').length).toBe(1);
    });
  });

  // ==========================================================================
  // Template Structure Parsing Tests
  // ==========================================================================

  describe('parseTemplateStructure', () => {
    it('should parse valid JSON structure', () => {
      const json = JSON.stringify({
        features: [
          { titleTemplate: 'Test', executionOrder: 1 },
        ],
      });

      const result = parseTemplateStructure(json);
      expect(result.features).toHaveLength(1);
      expect(result.features[0].titleTemplate).toBe('Test');
    });

    it('should throw ValidationError for invalid JSON', () => {
      expect(() => parseTemplateStructure('invalid json'))
        .toThrow(ValidationError);
    });

    it('should throw ValidationError for missing required fields', () => {
      const json = JSON.stringify({ features: [] });
      expect(() => parseTemplateStructure(json))
        .toThrow(ValidationError);
    });
  });

  // ==========================================================================
  // CRUD Operation Tests
  // ==========================================================================

  describe('listTemplates', () => {
    it('should return templates with feature counts', async () => {
      const mockTemplates = [
        {
          id: 'template-1',
          name: 'Code Feature',
          description: 'Standard feature workflow',
          isBuiltIn: true,
          structure: JSON.stringify({
            features: [
              { titleTemplate: 'Design', executionOrder: 1 },
              { titleTemplate: 'Implement', executionOrder: 2 },
            ],
          }),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(prisma.planTemplate.findMany).mockResolvedValue(mockTemplates as any);

      const result = await listTemplates();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Code Feature');
      expect(result[0].featureCount).toBe(2);
      expect(result[0].isBuiltIn).toBe(true);
    });
  });

  describe('getTemplate', () => {
    it('should find template by UUID', async () => {
      const mockTemplate = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Template',
      };

      vi.mocked(prisma.planTemplate.findFirst).mockResolvedValue(mockTemplate as any);

      const result = await getTemplate('550e8400-e29b-41d4-a716-446655440000');

      expect(result).toEqual(mockTemplate);
      expect(prisma.planTemplate.findFirst).toHaveBeenCalledWith({
        where: { id: '550e8400-e29b-41d4-a716-446655440000' },
      });
    });

    it('should find template by name', async () => {
      const mockTemplate = {
        id: 'template-1',
        name: 'Code Feature',
      };

      vi.mocked(prisma.planTemplate.findFirst).mockResolvedValue(mockTemplate as any);

      const result = await getTemplate('Code Feature');

      expect(result).toEqual(mockTemplate);
      expect(prisma.planTemplate.findFirst).toHaveBeenCalledWith({
        where: { name: 'Code Feature' },
      });
    });

    it('should return null for non-existent template', async () => {
      vi.mocked(prisma.planTemplate.findFirst).mockResolvedValue(null);

      const result = await getTemplate('Non-Existent');

      expect(result).toBeNull();
    });
  });

  describe('createTemplate', () => {
    it('should create a new template', async () => {
      const structure: TemplateStructure = {
        features: [{ titleTemplate: 'Test', executionOrder: 1 }],
      };

      vi.mocked(prisma.planTemplate.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.planTemplate.create).mockResolvedValue({
        id: 'new-template',
        name: 'My Template',
        description: 'Test description',
        structure: JSON.stringify(structure),
        isBuiltIn: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const result = await createTemplate({
        name: 'My Template',
        description: 'Test description',
        structure,
      });

      expect(result.name).toBe('My Template');
      expect(result.isBuiltIn).toBe(false);
    });

    it('should throw ConflictError for duplicate name', async () => {
      vi.mocked(prisma.planTemplate.findUnique).mockResolvedValue({
        id: 'existing',
        name: 'Existing Template',
      } as any);

      await expect(createTemplate({
        name: 'Existing Template',
        structure: { features: [{ titleTemplate: 'Test', executionOrder: 1 }] },
      })).rejects.toThrow(ConflictError);
    });
  });

  describe('updateTemplate', () => {
    it('should update a user-created template', async () => {
      vi.mocked(prisma.planTemplate.findFirst).mockResolvedValue({
        id: 'template-1',
        name: 'My Template',
        isBuiltIn: false,
      } as any);

      vi.mocked(prisma.planTemplate.findUnique).mockResolvedValue(null);

      vi.mocked(prisma.planTemplate.update).mockResolvedValue({
        id: 'template-1',
        name: 'Updated Template',
        isBuiltIn: false,
      } as any);

      const result = await updateTemplate('template-1', { name: 'Updated Template' });

      expect(result.name).toBe('Updated Template');
    });

    it('should throw ValidationError when updating built-in template', async () => {
      vi.mocked(prisma.planTemplate.findFirst).mockResolvedValue({
        id: 'template-1',
        name: 'Code Feature',
        isBuiltIn: true,
      } as any);

      await expect(updateTemplate('template-1', { name: 'New Name' }))
        .rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError for non-existent template', async () => {
      vi.mocked(prisma.planTemplate.findFirst).mockResolvedValue(null);

      await expect(updateTemplate('non-existent', { name: 'New Name' }))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('deleteTemplate', () => {
    it('should delete a user-created template', async () => {
      vi.mocked(prisma.planTemplate.findFirst).mockResolvedValue({
        id: 'template-1',
        name: 'My Template',
        isBuiltIn: false,
      } as any);

      vi.mocked(prisma.planTemplate.delete).mockResolvedValue({} as any);

      await expect(deleteTemplate('template-1')).resolves.toBeUndefined();
      expect(prisma.planTemplate.delete).toHaveBeenCalledWith({
        where: { id: 'template-1' },
      });
    });

    it('should throw ValidationError when deleting built-in template', async () => {
      vi.mocked(prisma.planTemplate.findFirst).mockResolvedValue({
        id: 'template-1',
        name: 'Code Feature',
        isBuiltIn: true,
      } as any);

      await expect(deleteTemplate('template-1'))
        .rejects.toThrow(ValidationError);
    });
  });

  // ==========================================================================
  // Preview Template Tests
  // ==========================================================================

  describe('previewTemplate', () => {
    it('should preview template with variable substitution', async () => {
      const structure: TemplateStructure = {
        epicDefaults: {
          icon: '🚀',
          color: '#3b82f6',
          descriptionPrompt: 'Implementation of {{topic}}',
        },
        features: [
          {
            titleTemplate: 'Research: {{topic}}',
            descriptionPrompt: 'Research {{topic}} best practices',
            executionOrder: 1,
            canParallelize: false,
            tasks: [
              {
                titleTemplate: 'Review {{topic}} patterns',
                executionOrder: 1,
              },
            ],
          },
        ],
      };

      vi.mocked(prisma.planTemplate.findFirst).mockResolvedValue({
        id: 'template-1',
        name: 'Code Feature',
        structure: JSON.stringify(structure),
      } as any);

      const result = await previewTemplate('Code Feature', 'My Epic', { topic: 'Payment Processing' });

      expect(result.epicName).toBe('My Epic');
      expect(result.epicDescription).toBe('Implementation of Payment Processing');
      expect(result.epicIcon).toBe('🚀');
      expect(result.features[0].title).toBe('Research: Payment Processing');
      expect(result.features[0].tasks[0].title).toBe('Review Payment Processing patterns');
    });
  });
});
