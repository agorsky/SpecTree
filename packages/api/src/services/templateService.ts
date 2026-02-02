import { prisma } from "../lib/db.js";
import type { PlanTemplate } from "../generated/prisma/index.js";
import { NotFoundError, ValidationError, ConflictError } from "../errors/index.js";
import type {
  TemplateStructure,
  TemplateFeature,
  TemplateTask,
  CreateFromTemplateInput,
} from "../schemas/template.js";
import { templateStructureSchema } from "../schemas/template.js";

// =============================================================================
// Types
// =============================================================================

export interface CreateTemplateInput {
  name: string;
  description?: string | undefined;
  structure: TemplateStructure;
  createdById?: string | undefined;
}

export interface UpdateTemplateInput {
  name?: string | undefined;
  description?: string | undefined;
  structure?: TemplateStructure | undefined;
}

export interface TemplateSummary {
  id: string;
  name: string;
  description: string | null;
  isBuiltIn: boolean;
  featureCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PreviewResult {
  epicName: string;
  epicDescription?: string;
  epicIcon?: string;
  epicColor?: string;
  features: {
    title: string;
    description?: string;
    executionOrder: number;
    canParallelize: boolean;
    tasks: {
      title: string;
      description?: string;
      executionOrder: number;
    }[];
  }[];
}

export interface CreateFromTemplateResult {
  epic: {
    id: string;
    name: string;
    description: string | null;
    icon: string | null;
    color: string | null;
  };
  features: {
    id: string;
    identifier: string;
    title: string;
    description: string | null;
    executionOrder: number | null;
    canParallelize: boolean;
    tasks: {
      id: string;
      identifier: string;
      title: string;
      description: string | null;
      executionOrder: number | null;
    }[];
  }[];
}

// =============================================================================
// Variable Substitution Engine
// =============================================================================

/**
 * Substitute {{variable}} placeholders in a template string
 * @param template - String containing {{variable}} placeholders
 * @param variables - Key-value pairs for substitution
 * @returns String with placeholders replaced by values
 */
export function substituteVariables(
  template: string,
  variables: Record<string, string> = {}
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, varName: string) => {
    return variables[varName] ?? match;
  });
}

/**
 * Extract all variable names from a template string
 * @param template - String containing {{variable}} placeholders
 * @returns Array of unique variable names
 */
export function extractVariables(template: string): string[] {
  const matches = template.match(/\{\{(\w+)\}\}/g) ?? [];
  const varNames = matches.map((m) => m.replace(/\{\{|\}\}/g, ""));
  return [...new Set(varNames)];
}

/**
 * Extract all variables from an entire template structure
 */
export function extractTemplateVariables(structure: TemplateStructure): string[] {
  const allVariables: string[] = [];

  // Check epic defaults
  if (structure.epicDefaults?.descriptionPrompt) {
    allVariables.push(...extractVariables(structure.epicDefaults.descriptionPrompt));
  }

  // Check features
  for (const feature of structure.features) {
    allVariables.push(...extractVariables(feature.titleTemplate));
    if (feature.descriptionPrompt) {
      allVariables.push(...extractVariables(feature.descriptionPrompt));
    }

    // Check tasks
    if (feature.tasks) {
      for (const task of feature.tasks) {
        allVariables.push(...extractVariables(task.titleTemplate));
        if (task.descriptionPrompt) {
          allVariables.push(...extractVariables(task.descriptionPrompt));
        }
      }
    }
  }

  return [...new Set(allVariables)];
}

// =============================================================================
// Template Parsing
// =============================================================================

/**
 * Parse and validate template structure from JSON string
 */
export function parseTemplateStructure(json: string): TemplateStructure {
  try {
    const parsed: unknown = JSON.parse(json);
    return templateStructureSchema.parse(parsed);
  } catch (error) {
    if (error instanceof Error) {
      throw new ValidationError(`Invalid template structure: ${error.message}`);
    }
    throw new ValidationError("Invalid template structure");
  }
}

// =============================================================================
// CRUD Operations
// =============================================================================

/**
 * List all templates with summary information
 */
export async function listTemplates(): Promise<TemplateSummary[]> {
  const templates = await prisma.planTemplate.findMany({
    orderBy: [{ isBuiltIn: "desc" }, { name: "asc" }],
  });

  return templates.map((t) => {
    const structure = parseTemplateStructure(t.structure);
    return {
      id: t.id,
      name: t.name,
      description: t.description,
      isBuiltIn: t.isBuiltIn,
      featureCount: structure.features.length,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  });
}

/**
 * Get a template by ID or name
 */
export async function getTemplate(idOrName: string): Promise<PlanTemplate | null> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    idOrName
  );

  return prisma.planTemplate.findFirst({
    where: isUuid ? { id: idOrName } : { name: idOrName },
  });
}

/**
 * Get a template or throw NotFoundError
 */
export async function getTemplateOrThrow(idOrName: string): Promise<PlanTemplate> {
  const template = await getTemplate(idOrName);
  if (!template) {
    throw new NotFoundError(`Template '${idOrName}' not found`);
  }
  return template;
}

/**
 * Create a new template
 */
export async function createTemplate(input: CreateTemplateInput): Promise<PlanTemplate> {
  // Validate name is unique
  const existing = await prisma.planTemplate.findUnique({
    where: { name: input.name },
  });
  if (existing) {
    throw new ConflictError(`Template with name '${input.name}' already exists`);
  }

  // Build data object conditionally to handle optional fields
  const data: {
    name: string;
    structure: string;
    isBuiltIn: boolean;
    description?: string;
    createdById?: string;
  } = {
    name: input.name,
    structure: JSON.stringify(input.structure),
    isBuiltIn: false,
  };
  
  if (input.description !== undefined) {
    data.description = input.description;
  }
  if (input.createdById !== undefined) {
    data.createdById = input.createdById;
  }

  return prisma.planTemplate.create({ data });
}

/**
 * Update an existing template (only user-created templates can be updated)
 */
export async function updateTemplate(
  idOrName: string,
  input: UpdateTemplateInput
): Promise<PlanTemplate> {
  const template = await getTemplateOrThrow(idOrName);

  if (template.isBuiltIn) {
    throw new ValidationError("Built-in templates cannot be modified");
  }

  // If changing name, check for conflicts
  if (input.name && input.name !== template.name) {
    const existing = await prisma.planTemplate.findUnique({
      where: { name: input.name },
    });
    if (existing) {
      throw new ConflictError(`Template with name '${input.name}' already exists`);
    }
  }

  const data: { name?: string; description?: string; structure?: string } = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.structure !== undefined) data.structure = JSON.stringify(input.structure);

  return prisma.planTemplate.update({
    where: { id: template.id },
    data,
  });
}

/**
 * Delete a template (only user-created templates can be deleted)
 */
export async function deleteTemplate(idOrName: string): Promise<void> {
  const template = await getTemplateOrThrow(idOrName);

  if (template.isBuiltIn) {
    throw new ValidationError("Built-in templates cannot be deleted");
  }

  await prisma.planTemplate.delete({
    where: { id: template.id },
  });
}

// =============================================================================
// Template Operations
// =============================================================================

/**
 * Preview what will be created from a template with variable substitution
 */
export async function previewTemplate(
  templateName: string,
  epicName: string,
  variables: Record<string, string> = {}
): Promise<PreviewResult> {
  const template = await getTemplateOrThrow(templateName);
  const structure = parseTemplateStructure(template.structure);

  const result: PreviewResult = {
    epicName,
    features: [],
  };

  // Apply epic defaults
  if (structure.epicDefaults) {
    if (structure.epicDefaults.descriptionPrompt) {
      result.epicDescription = substituteVariables(
        structure.epicDefaults.descriptionPrompt,
        variables
      );
    }
    if (structure.epicDefaults.icon) {
      result.epicIcon = structure.epicDefaults.icon;
    }
    if (structure.epicDefaults.color) {
      result.epicColor = structure.epicDefaults.color;
    }
  }

  // Process features
  for (const featureTemplate of structure.features) {
    const feature: PreviewResult["features"][0] = {
      title: substituteVariables(featureTemplate.titleTemplate, variables),
      executionOrder: featureTemplate.executionOrder,
      canParallelize: featureTemplate.canParallelize,
      tasks: [],
    };
    
    if (featureTemplate.descriptionPrompt) {
      feature.description = substituteVariables(featureTemplate.descriptionPrompt, variables);
    }

    // Process tasks
    if (featureTemplate.tasks) {
      for (const taskTemplate of featureTemplate.tasks) {
        const task: PreviewResult["features"][0]["tasks"][0] = {
          title: substituteVariables(taskTemplate.titleTemplate, variables),
          executionOrder: taskTemplate.executionOrder,
        };
        
        if (taskTemplate.descriptionPrompt) {
          task.description = substituteVariables(taskTemplate.descriptionPrompt, variables);
        }
        
        feature.tasks.push(task);
      }
    }

    result.features.push(feature);
  }

  return result;
}

/**
 * Create a full epic/feature/task structure from a template
 */
export async function createFromTemplate(
  input: CreateFromTemplateInput
): Promise<CreateFromTemplateResult> {
  const template = await getTemplateOrThrow(input.templateName);
  const structure = parseTemplateStructure(template.structure);
  const variables = input.variables ?? {};

  // Verify team exists
  const team = await prisma.team.findUnique({
    where: { id: input.teamId },
    select: { id: true, key: true, isArchived: true },
  });

  if (!team || team.isArchived) {
    throw new NotFoundError(`Team with id '${input.teamId}' not found`);
  }

  // Type assertion: key is guaranteed to exist after the check above
  const teamKey = team.key;

  // Get the highest feature number for this team to generate identifiers
  const lastFeature = await prisma.feature.findFirst({
    where: { epic: { teamId: input.teamId } },
    orderBy: { identifier: "desc" },
    select: { identifier: true },
  });

  let featureCounter = 1;
  if (lastFeature) {
    const match = /-(\d+)$/.exec(lastFeature.identifier);
    if (match?.[1]) {
      featureCounter = parseInt(match[1], 10) + 1;
    }
  }

  // Use a transaction to create everything atomically
  return prisma.$transaction(async (tx) => {
    // Create epic
    const epicData = {
      name: input.epicName,
      description:
        input.epicDescription ??
        (structure.epicDefaults?.descriptionPrompt
          ? substituteVariables(structure.epicDefaults.descriptionPrompt, variables)
          : null),
      icon: input.epicIcon ?? structure.epicDefaults?.icon ?? null,
      color: input.epicColor ?? structure.epicDefaults?.color ?? null,
      teamId: input.teamId,
    };

    const epic = await tx.epic.create({ data: epicData });

    const features: CreateFromTemplateResult["features"] = [];

    // Create features and tasks
    for (const featureTemplate of structure.features) {
      const featureIdentifier = `${teamKey}-${String(featureCounter)}`;
      featureCounter++;

      const featureData = {
        identifier: featureIdentifier,
        title: substituteVariables(featureTemplate.titleTemplate, variables),
        description: featureTemplate.descriptionPrompt
          ? substituteVariables(featureTemplate.descriptionPrompt, variables)
          : null,
        epicId: epic.id,
        executionOrder: featureTemplate.executionOrder,
        canParallelize: featureTemplate.canParallelize,
        sortOrder: featureTemplate.executionOrder,
      };

      const feature = await tx.feature.create({ data: featureData });

      const tasks: CreateFromTemplateResult["features"][0]["tasks"] = [];

      // Create tasks for this feature
      if (featureTemplate.tasks) {
        let taskCounter = 1;
        for (const taskTemplate of featureTemplate.tasks) {
          const taskIdentifier = `${featureIdentifier}-${String(taskCounter)}`;
          taskCounter++;

          const taskData = {
            identifier: taskIdentifier,
            title: substituteVariables(taskTemplate.titleTemplate, variables),
            description: taskTemplate.descriptionPrompt
              ? substituteVariables(taskTemplate.descriptionPrompt, variables)
              : null,
            featureId: feature.id,
            executionOrder: taskTemplate.executionOrder,
            sortOrder: taskTemplate.executionOrder,
          };

          const task = await tx.task.create({ data: taskData });
          tasks.push({
            id: task.id,
            identifier: task.identifier,
            title: task.title,
            description: task.description,
            executionOrder: task.executionOrder,
          });
        }
      }

      features.push({
        id: feature.id,
        identifier: feature.identifier,
        title: feature.title,
        description: feature.description,
        executionOrder: feature.executionOrder,
        canParallelize: feature.canParallelize,
        tasks,
      });
    }

    return {
      epic: {
        id: epic.id,
        name: epic.name,
        description: epic.description,
        icon: epic.icon,
        color: epic.color,
      },
      features,
    };
  });
}

/**
 * Save an existing epic's structure as a new template
 */
export async function saveAsTemplate(
  epicId: string,
  templateName: string,
  description?: string,
  createdById?: string
): Promise<PlanTemplate> {
  // Verify epic exists
  const epic = await prisma.epic.findUnique({
    where: { id: epicId },
    include: {
      features: {
        orderBy: [{ executionOrder: "asc" }, { sortOrder: "asc" }],
        include: {
          tasks: {
            orderBy: [{ executionOrder: "asc" }, { sortOrder: "asc" }],
          },
        },
      },
    },
  });

  if (!epic) {
    throw new NotFoundError(`Epic with id '${epicId}' not found`);
  }

  if (epic.features.length === 0) {
    throw new ValidationError("Cannot create template from epic with no features");
  }

  // Check for name conflict
  const existing = await prisma.planTemplate.findUnique({
    where: { name: templateName },
  });
  if (existing) {
    throw new ConflictError(`Template with name '${templateName}' already exists`);
  }

  // Build template structure from epic
  const structure: TemplateStructure = {
    epicDefaults: {
      icon: epic.icon ?? undefined,
      color: epic.color ?? undefined,
      descriptionPrompt: epic.description ?? undefined,
    },
    features: epic.features.map((f, fIndex): TemplateFeature => ({
      titleTemplate: f.title,
      descriptionPrompt: f.description ?? undefined,
      executionOrder: f.executionOrder ?? fIndex + 1,
      canParallelize: f.canParallelize,
      tasks: f.tasks.map((t, tIndex): TemplateTask => ({
        titleTemplate: t.title,
        descriptionPrompt: t.description ?? undefined,
        executionOrder: t.executionOrder ?? tIndex + 1,
      })),
    })),
  };

  // Build data object conditionally to handle optional createdById
  const data: {
    name: string;
    description: string;
    structure: string;
    isBuiltIn: boolean;
    createdById?: string;
  } = {
    name: templateName,
    description: description ?? `Template created from epic "${epic.name}"`,
    structure: JSON.stringify(structure),
    isBuiltIn: false,
  };
  
  if (createdById !== undefined) {
    data.createdById = createdById;
  }

  return prisma.planTemplate.create({ data });
}
