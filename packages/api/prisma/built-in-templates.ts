/**
 * Built-in Plan Templates for SpecTree
 * 
 * These templates include comprehensive structured descriptions with:
 * - estimatedComplexity for features and tasks
 * - structuredDescTemplate with AI instructions, acceptance criteria, risk levels
 * - Detailed guidance for AI agents
 */

import type { TemplateStructure } from "../src/schemas/template.js";

// =============================================================================
// Code Feature Template (Enhanced)
// =============================================================================

const codeFeatureTemplate: TemplateStructure = {
  epicDefaults: {
    icon: "🚀",
    color: "#3b82f6",
    descriptionPrompt: "Implementation of {{topic}}",
  },
  features: [
    {
      titleTemplate: "Research: {{topic}}",
      descriptionPrompt: "Research existing solutions, patterns, and best practices for {{topic}}",
      executionOrder: 1,
      canParallelize: false,
      estimatedComplexity: "simple",
      structuredDescTemplate: {
        summary: "Research phase for {{topic}} - gather requirements, analyze existing patterns, and document findings",
        aiInstructions: "Use grep/glob to find similar patterns in the codebase. Check for existing utilities, services, or components that could be reused. Document all findings before proceeding to design.",
        acceptanceCriteria: [
          "Existing codebase patterns documented",
          "Industry best practices identified",
          "Reusable components/utilities listed",
          "Findings documented in AI notes",
        ],
        riskLevel: "low",
        estimatedEffort: "small",
      },
      tasks: [
        {
          titleTemplate: "Review existing codebase for similar patterns",
          executionOrder: 1,
          estimatedComplexity: "trivial",
          structuredDescTemplate: {
            summary: "Search codebase for similar implementations to {{topic}}",
            aiInstructions: "Use grep to search for related keywords, patterns, and implementations. Look in services/, components/, utils/ directories. Document file paths and patterns found.",
            acceptanceCriteria: [
              "Searched all relevant directories",
              "Similar patterns documented with file paths",
              "Reusable code identified",
            ],
          },
        },
        {
          titleTemplate: "Research industry best practices",
          executionOrder: 2,
          estimatedComplexity: "trivial",
          structuredDescTemplate: {
            summary: "Research how {{topic}} is typically implemented",
            aiInstructions: "Consider common patterns, security implications, performance considerations. Look at how popular libraries handle this. Document trade-offs of different approaches.",
            acceptanceCriteria: [
              "Best practices identified",
              "Security considerations documented",
              "Performance implications noted",
            ],
          },
        },
        {
          titleTemplate: "Document findings and recommendations",
          executionOrder: 3,
          estimatedComplexity: "trivial",
          structuredDescTemplate: {
            summary: "Compile research findings into actionable recommendations",
            aiInstructions: "Create a summary of findings using spectree__append_ai_note. Include recommended approach, files to modify, and potential risks. This will guide the design phase.",
            acceptanceCriteria: [
              "Findings summarized in AI notes",
              "Recommended approach documented",
              "Risks and trade-offs identified",
            ],
          },
        },
      ],
    },
    {
      titleTemplate: "Design: {{topic}}",
      descriptionPrompt: "Design the architecture and approach for {{topic}}",
      executionOrder: 2,
      canParallelize: false,
      estimatedComplexity: "moderate",
      structuredDescTemplate: {
        summary: "Design phase for {{topic}} - define interfaces, data models, and implementation approach",
        aiInstructions: "Based on research findings, design the solution. Define TypeScript interfaces, data models, and component structure. Consider extensibility and testability. Use spectree__log_decision for architectural choices.",
        acceptanceCriteria: [
          "Interfaces and types defined",
          "Data models documented",
          "Component/service structure planned",
          "Design decisions logged with rationale",
        ],
        riskLevel: "medium",
        estimatedEffort: "medium",
      },
      tasks: [
        {
          titleTemplate: "Create technical design document",
          executionOrder: 1,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Document the technical design for {{topic}}",
            aiInstructions: "Create a design document in AI notes covering: architecture overview, component interactions, data flow, error handling strategy. Use spectree__log_decision for major choices.",
            acceptanceCriteria: [
              "Architecture overview documented",
              "Component interactions defined",
              "Error handling strategy outlined",
            ],
          },
        },
        {
          titleTemplate: "Define interfaces and data models",
          executionOrder: 2,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Define TypeScript interfaces and data models for {{topic}}",
            aiInstructions: "Create TypeScript interfaces in appropriate files. Follow existing naming conventions (check similar files). Include JSDoc comments. Consider validation schemas if using Zod.",
            acceptanceCriteria: [
              "TypeScript interfaces created",
              "Data models defined with proper types",
              "JSDoc comments added",
              "Follows existing naming conventions",
            ],
          },
        },
        {
          titleTemplate: "Review design with team",
          executionOrder: 3,
          estimatedComplexity: "trivial",
          structuredDescTemplate: {
            summary: "Validate design approach before implementation",
            aiInstructions: "If working autonomously, validate design by checking against existing patterns. Ensure consistency with codebase conventions. Log any assumptions made.",
            acceptanceCriteria: [
              "Design reviewed against existing patterns",
              "Assumptions documented",
              "Ready for implementation",
            ],
          },
        },
      ],
    },
    {
      titleTemplate: "Implement: {{topic}}",
      descriptionPrompt: "Build the core functionality for {{topic}}",
      executionOrder: 3,
      canParallelize: false,
      estimatedComplexity: "complex",
      structuredDescTemplate: {
        summary: "Implementation phase for {{topic}} - build the core functionality following the design",
        aiInstructions: "Implement according to the design. Create small, focused commits. Run tests after each significant change. Use spectree__link_code_file to track modified files. Follow existing code style.",
        acceptanceCriteria: [
          "Core functionality implemented",
          "Error handling in place",
          "Code follows project conventions",
          "All modified files linked to feature",
          "No linting errors",
        ],
        riskLevel: "medium",
        estimatedEffort: "large",
      },
      tasks: [
        {
          titleTemplate: "Set up project structure",
          executionOrder: 1,
          estimatedComplexity: "trivial",
          structuredDescTemplate: {
            summary: "Create necessary files and folders for {{topic}}",
            aiInstructions: "Create new files following project structure conventions. Add necessary exports to index files. Set up basic boilerplate. Link created files using spectree__link_code_file.",
            acceptanceCriteria: [
              "Files created in correct locations",
              "Exports added to index files",
              "Basic structure in place",
            ],
          },
        },
        {
          titleTemplate: "Implement core logic",
          executionOrder: 2,
          estimatedComplexity: "moderate",
          structuredDescTemplate: {
            summary: "Implement the main functionality for {{topic}}",
            aiInstructions: "Implement the core logic following the design. Keep functions focused and testable. Add inline comments for complex logic. Run linter frequently to catch issues early.",
            acceptanceCriteria: [
              "Core logic implemented",
              "Functions are focused and testable",
              "Complex logic commented",
              "Linter passes",
            ],
          },
        },
        {
          titleTemplate: "Add error handling",
          executionOrder: 3,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Add comprehensive error handling to {{topic}}",
            aiInstructions: "Add try-catch blocks, validation, and meaningful error messages. Use existing error classes/utilities. Ensure errors are logged appropriately. Handle edge cases.",
            acceptanceCriteria: [
              "All error paths handled",
              "Meaningful error messages",
              "Uses existing error utilities",
              "Edge cases handled",
            ],
          },
        },
        {
          titleTemplate: "Code review and refactoring",
          executionOrder: 4,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Review and refactor implementation of {{topic}}",
            aiInstructions: "Review the implementation for code quality. Look for duplication, complex functions, missing types. Refactor as needed. Ensure consistent style with rest of codebase.",
            acceptanceCriteria: [
              "No code duplication",
              "Functions are appropriately sized",
              "Types are complete",
              "Consistent code style",
            ],
          },
        },
      ],
    },
    {
      titleTemplate: "Test: {{topic}}",
      descriptionPrompt: "Comprehensive testing for {{topic}}",
      executionOrder: 4,
      canParallelize: false,
      estimatedComplexity: "moderate",
      structuredDescTemplate: {
        summary: "Testing phase for {{topic}} - write unit tests, integration tests, and verify edge cases",
        aiInstructions: "Write comprehensive tests following existing test patterns. Use the project's testing framework (check package.json). Aim for high coverage of critical paths. Test error scenarios.",
        acceptanceCriteria: [
          "Unit tests written for all functions",
          "Integration tests for main flows",
          "Edge cases tested",
          "All tests pass",
          "Test files linked to feature",
        ],
        riskLevel: "low",
        estimatedEffort: "medium",
      },
      tasks: [
        {
          titleTemplate: "Write unit tests",
          executionOrder: 1,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Write unit tests for {{topic}} components",
            aiInstructions: "Create unit tests in the appropriate test directory. Follow existing test patterns. Mock external dependencies. Test happy paths and error cases. Use descriptive test names.",
            acceptanceCriteria: [
              "Unit tests created",
              "Happy paths tested",
              "Error cases tested",
              "Tests follow project patterns",
            ],
          },
        },
        {
          titleTemplate: "Write integration tests",
          executionOrder: 2,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Write integration tests for {{topic}}",
            aiInstructions: "Create integration tests that test components working together. For APIs, test full request/response cycle. Use test fixtures appropriately.",
            acceptanceCriteria: [
              "Integration tests created",
              "Tests cover main user flows",
              "External services properly mocked",
            ],
          },
        },
        {
          titleTemplate: "Manual testing and edge cases",
          executionOrder: 3,
          estimatedComplexity: "trivial",
          structuredDescTemplate: {
            summary: "Test edge cases and verify {{topic}} behavior",
            aiInstructions: "Test edge cases that automated tests might miss. Verify error messages are user-friendly. Test boundary conditions. Document any issues found.",
            acceptanceCriteria: [
              "Edge cases tested",
              "Boundary conditions verified",
              "Error messages reviewed",
              "Issues documented",
            ],
          },
        },
      ],
    },
    {
      titleTemplate: "Document: {{topic}}",
      descriptionPrompt: "Documentation for {{topic}}",
      executionOrder: 5,
      canParallelize: false,
      estimatedComplexity: "simple",
      structuredDescTemplate: {
        summary: "Documentation phase for {{topic}} - update API docs, add code comments, update README",
        aiInstructions: "Update all relevant documentation. Add JSDoc comments to public APIs. Update README if this is a user-facing feature. Ensure examples are accurate and helpful.",
        acceptanceCriteria: [
          "API documentation updated",
          "JSDoc comments on public APIs",
          "README updated if applicable",
          "Examples are accurate",
        ],
        riskLevel: "low",
        estimatedEffort: "small",
      },
      tasks: [
        {
          titleTemplate: "Update API documentation",
          executionOrder: 1,
          estimatedComplexity: "trivial",
          structuredDescTemplate: {
            summary: "Update API documentation for {{topic}}",
            aiInstructions: "Update OpenAPI/Swagger docs if applicable. Document request/response formats. Include example requests. Document error responses.",
            acceptanceCriteria: [
              "API endpoints documented",
              "Request/response formats included",
              "Examples provided",
            ],
          },
        },
        {
          titleTemplate: "Add code comments",
          executionOrder: 2,
          estimatedComplexity: "trivial",
          structuredDescTemplate: {
            summary: "Add JSDoc comments and inline documentation",
            aiInstructions: "Add JSDoc comments to all public functions and classes. Add inline comments for complex logic. Ensure type documentation is complete.",
            acceptanceCriteria: [
              "JSDoc on public APIs",
              "Complex logic commented",
              "Types documented",
            ],
          },
        },
        {
          titleTemplate: "Update README if needed",
          executionOrder: 3,
          estimatedComplexity: "trivial",
          structuredDescTemplate: {
            summary: "Update README and user-facing documentation",
            aiInstructions: "If this feature affects users, update the README. Add usage examples. Update any getting started guides. Keep documentation concise and practical.",
            acceptanceCriteria: [
              "README updated if applicable",
              "Usage examples added",
              "Documentation is clear and concise",
            ],
          },
        },
      ],
    },
  ],
};

// =============================================================================
// Bug Fix Template (Enhanced)
// =============================================================================

const bugFixTemplate: TemplateStructure = {
  epicDefaults: {
    icon: "🐛",
    color: "#ef4444",
    descriptionPrompt: "Fix bug: {{topic}}",
  },
  features: [
    {
      titleTemplate: "Reproduce: {{topic}}",
      descriptionPrompt: "Reliably reproduce the bug to understand the issue",
      executionOrder: 1,
      canParallelize: false,
      estimatedComplexity: "simple",
      structuredDescTemplate: {
        summary: "Reproduce the bug reliably to understand the exact conditions that cause {{topic}}",
        aiInstructions: "Create a minimal reproduction case. Document exact steps to reproduce. Identify which versions/environments are affected. Use spectree__append_ai_note to log reproduction steps.",
        acceptanceCriteria: [
          "Bug can be reproduced consistently",
          "Reproduction steps documented",
          "Affected versions/environments identified",
          "Minimal reproduction case created",
        ],
        riskLevel: "low",
        estimatedEffort: "small",
      },
      tasks: [
        {
          titleTemplate: "Create minimal reproduction case",
          executionOrder: 1,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Create a minimal test case that reproduces {{topic}}",
            aiInstructions: "Strip away unrelated code to find the minimal case that triggers the bug. This helps identify root cause and creates a good regression test.",
            acceptanceCriteria: [
              "Minimal reproduction created",
              "Can trigger bug consistently",
              "Unrelated code removed",
            ],
          },
        },
        {
          titleTemplate: "Document reproduction steps",
          executionOrder: 2,
          estimatedComplexity: "trivial",
          structuredDescTemplate: {
            summary: "Document exact steps to reproduce {{topic}}",
            aiInstructions: "Write clear, numbered steps to reproduce. Include any required data, configuration, or state. Log using spectree__append_ai_note for future reference.",
            acceptanceCriteria: [
              "Steps are clear and numbered",
              "Required data/config documented",
              "Steps logged in AI notes",
            ],
          },
        },
        {
          titleTemplate: "Identify affected versions/environments",
          executionOrder: 3,
          estimatedComplexity: "trivial",
          structuredDescTemplate: {
            summary: "Determine which versions and environments are affected by {{topic}}",
            aiInstructions: "Test on different environments if possible. Check git history to find when the bug was introduced. This helps scope the fix and identify regression potential.",
            acceptanceCriteria: [
              "Affected versions identified",
              "Affected environments documented",
              "Introduction point identified if possible",
            ],
          },
        },
      ],
    },
    {
      titleTemplate: "Investigate: {{topic}}",
      descriptionPrompt: "Root cause analysis for the bug",
      executionOrder: 2,
      canParallelize: false,
      estimatedComplexity: "moderate",
      structuredDescTemplate: {
        summary: "Investigate and identify the root cause of {{topic}}",
        aiInstructions: "Analyze logs, trace execution, use debugging tools. Don't just fix the symptom - find the actual root cause. Use spectree__log_decision to document your analysis approach.",
        acceptanceCriteria: [
          "Root cause identified",
          "Investigation approach documented",
          "Related code areas identified",
          "Fix approach determined",
        ],
        riskLevel: "medium",
        estimatedEffort: "medium",
      },
      tasks: [
        {
          titleTemplate: "Analyze logs and error messages",
          executionOrder: 1,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Analyze logs and error messages related to {{topic}}",
            aiInstructions: "Check application logs, browser console, server logs. Look for error messages, stack traces, and unusual patterns. Document relevant log entries.",
            acceptanceCriteria: [
              "Logs analyzed",
              "Error messages documented",
              "Stack traces captured",
            ],
          },
        },
        {
          titleTemplate: "Debug and trace execution",
          executionOrder: 2,
          estimatedComplexity: "moderate",
          structuredDescTemplate: {
            summary: "Debug and trace the code execution to find {{topic}} root cause",
            aiInstructions: "Add console.log/debugger statements or use debugger tools. Trace the execution path. Identify where actual behavior diverges from expected. Link relevant files.",
            acceptanceCriteria: [
              "Execution path traced",
              "Divergence point identified",
              "Relevant code files linked",
            ],
          },
        },
        {
          titleTemplate: "Identify root cause",
          executionOrder: 3,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Document the root cause of {{topic}}",
            aiInstructions: "Summarize the root cause clearly. Explain why the bug occurs. Use spectree__append_ai_note with type 'observation' to document. Consider if there are similar bugs elsewhere.",
            acceptanceCriteria: [
              "Root cause clearly documented",
              "Explanation of why bug occurs",
              "Similar issues identified if any",
            ],
          },
        },
      ],
    },
    {
      titleTemplate: "Fix: {{topic}}",
      descriptionPrompt: "Implement the fix and ensure quality",
      executionOrder: 3,
      canParallelize: false,
      estimatedComplexity: "moderate",
      structuredDescTemplate: {
        summary: "Implement the fix for {{topic}} with proper testing",
        aiInstructions: "Fix the root cause, not just the symptom. Keep the fix minimal and focused. Add a regression test. Get code reviewed. Use spectree__link_code_file for all modified files.",
        acceptanceCriteria: [
          "Root cause fixed",
          "Fix is minimal and focused",
          "Regression test added",
          "No new issues introduced",
          "Modified files linked",
        ],
        riskLevel: "medium",
        estimatedEffort: "medium",
      },
      tasks: [
        {
          titleTemplate: "Implement fix",
          executionOrder: 1,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Implement the fix for {{topic}}",
            aiInstructions: "Apply the fix based on root cause analysis. Keep changes minimal. Don't refactor unrelated code. Test the fix against reproduction case.",
            acceptanceCriteria: [
              "Fix implemented",
              "Changes are minimal",
              "Fix addresses root cause",
              "Reproduction case no longer fails",
            ],
          },
        },
        {
          titleTemplate: "Add regression test",
          executionOrder: 2,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Add a regression test for {{topic}}",
            aiInstructions: "Create a test that would have caught this bug. Use the minimal reproduction case as a basis. Test should fail without the fix and pass with it.",
            acceptanceCriteria: [
              "Regression test created",
              "Test fails without fix",
              "Test passes with fix",
              "Test follows project patterns",
            ],
          },
        },
        {
          titleTemplate: "Code review",
          executionOrder: 3,
          estimatedComplexity: "trivial",
          structuredDescTemplate: {
            summary: "Review the fix for {{topic}}",
            aiInstructions: "Review the fix for correctness, style, and potential side effects. Ensure the fix doesn't introduce new issues. Check that the regression test is comprehensive.",
            acceptanceCriteria: [
              "Fix reviewed for correctness",
              "No side effects identified",
              "Code style is consistent",
              "Test coverage is adequate",
            ],
          },
        },
      ],
    },
    {
      titleTemplate: "Verify: {{topic}}",
      descriptionPrompt: "Verify the fix works and doesn't introduce regressions",
      executionOrder: 4,
      canParallelize: false,
      estimatedComplexity: "simple",
      structuredDescTemplate: {
        summary: "Verify the fix for {{topic}} works correctly without causing regressions",
        aiInstructions: "Run the original reproduction case. Run the full test suite. Test related functionality. Use spectree__run_all_validations if validations are defined.",
        acceptanceCriteria: [
          "Original issue resolved",
          "Full test suite passes",
          "No regressions in related functionality",
          "Fix verified in target environments",
        ],
        riskLevel: "low",
        estimatedEffort: "small",
      },
      tasks: [
        {
          titleTemplate: "Verify fix resolves original issue",
          executionOrder: 1,
          estimatedComplexity: "trivial",
          structuredDescTemplate: {
            summary: "Verify {{topic}} is fixed",
            aiInstructions: "Run the original reproduction steps. Confirm the bug no longer occurs. Test any variations of the bug that were identified.",
            acceptanceCriteria: [
              "Original issue no longer occurs",
              "All variations tested",
              "Fix confirmed working",
            ],
          },
        },
        {
          titleTemplate: "Run full test suite",
          executionOrder: 2,
          estimatedComplexity: "trivial",
          structuredDescTemplate: {
            summary: "Run full test suite to check for regressions",
            aiInstructions: "Run the complete test suite. Investigate any failures. Ensure no existing tests were broken by the fix.",
            acceptanceCriteria: [
              "Full test suite passes",
              "No test regressions",
              "New regression test passes",
            ],
          },
        },
        {
          titleTemplate: "Test related functionality",
          executionOrder: 3,
          estimatedComplexity: "trivial",
          structuredDescTemplate: {
            summary: "Test functionality related to {{topic}}",
            aiInstructions: "Identify and test related features that could be affected. Test edge cases. Ensure the fix doesn't have unintended consequences.",
            acceptanceCriteria: [
              "Related features tested",
              "Edge cases verified",
              "No unintended consequences",
            ],
          },
        },
      ],
    },
  ],
};

// =============================================================================
// Refactoring Template (Enhanced)
// =============================================================================

const refactoringTemplate: TemplateStructure = {
  epicDefaults: {
    icon: "🔧",
    color: "#8b5cf6",
    descriptionPrompt: "Refactoring: {{topic}}",
  },
  features: [
    {
      titleTemplate: "Analyze: {{topic}}",
      descriptionPrompt: "Analyze current code structure and identify improvements",
      executionOrder: 1,
      canParallelize: false,
      estimatedComplexity: "simple",
      structuredDescTemplate: {
        summary: "Analyze the current code structure of {{topic}} to identify improvement opportunities",
        aiInstructions: "Map the current code structure. Identify code smells, duplication, and complexity. Document technical debt. Use spectree__link_code_file to track analyzed files.",
        acceptanceCriteria: [
          "Current structure mapped",
          "Code smells identified",
          "Technical debt documented",
          "Improvement opportunities listed",
        ],
        riskLevel: "low",
        estimatedEffort: "small",
      },
      tasks: [
        {
          titleTemplate: "Map current code structure",
          executionOrder: 1,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Map the current code structure for {{topic}}",
            aiInstructions: "Document the current file structure, dependencies, and relationships. Create a mental model of how the code works. Link all relevant files.",
            acceptanceCriteria: [
              "File structure documented",
              "Dependencies mapped",
              "Relationships understood",
            ],
          },
        },
        {
          titleTemplate: "Identify code smells and issues",
          executionOrder: 2,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Identify code smells and issues in {{topic}}",
            aiInstructions: "Look for: long functions, duplicate code, complex conditionals, tight coupling, poor naming, missing types, outdated patterns. Document each issue.",
            acceptanceCriteria: [
              "Code smells identified",
              "Issues documented with locations",
              "Severity assessed",
            ],
          },
        },
        {
          titleTemplate: "Document technical debt",
          executionOrder: 3,
          estimatedComplexity: "trivial",
          structuredDescTemplate: {
            summary: "Document technical debt in {{topic}}",
            aiInstructions: "Compile a list of technical debt items. Prioritize by impact and effort. Use spectree__append_ai_note to document. This guides the refactoring plan.",
            acceptanceCriteria: [
              "Technical debt itemized",
              "Items prioritized",
              "Documented in AI notes",
            ],
          },
        },
      ],
    },
    {
      titleTemplate: "Plan: {{topic}}",
      descriptionPrompt: "Plan the refactoring approach",
      executionOrder: 2,
      canParallelize: false,
      estimatedComplexity: "moderate",
      structuredDescTemplate: {
        summary: "Plan the refactoring approach for {{topic}} with clear steps and risk mitigation",
        aiInstructions: "Define the target architecture. Create a step-by-step migration strategy. Identify risks and mitigation. Use spectree__log_decision for major architectural choices.",
        acceptanceCriteria: [
          "Target architecture defined",
          "Migration steps planned",
          "Risks identified with mitigations",
          "Decisions logged with rationale",
        ],
        riskLevel: "medium",
        estimatedEffort: "medium",
      },
      tasks: [
        {
          titleTemplate: "Define target architecture",
          executionOrder: 1,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Define the target architecture for {{topic}}",
            aiInstructions: "Design the improved code structure. Consider SOLID principles, separation of concerns, and testability. Document the target state clearly.",
            acceptanceCriteria: [
              "Target structure defined",
              "Follows best practices",
              "Improves testability",
              "Clear documentation",
            ],
          },
        },
        {
          titleTemplate: "Create migration strategy",
          executionOrder: 2,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Create a step-by-step migration strategy for {{topic}}",
            aiInstructions: "Break the refactoring into small, safe steps. Each step should keep the code working. Plan for incremental commits that can be reviewed individually.",
            acceptanceCriteria: [
              "Steps are small and safe",
              "Code stays working at each step",
              "Steps can be committed individually",
            ],
          },
        },
        {
          titleTemplate: "Identify risks and mitigation",
          executionOrder: 3,
          estimatedComplexity: "trivial",
          structuredDescTemplate: {
            summary: "Identify risks in refactoring {{topic}} and plan mitigations",
            aiInstructions: "Consider: breaking existing functionality, introducing bugs, performance regression. Plan mitigations: good test coverage, incremental changes, performance benchmarks.",
            acceptanceCriteria: [
              "Risks identified",
              "Mitigations planned",
              "Test coverage requirements defined",
            ],
          },
        },
      ],
    },
    {
      titleTemplate: "Execute: {{topic}}",
      descriptionPrompt: "Execute the refactoring in safe increments",
      executionOrder: 3,
      canParallelize: false,
      estimatedComplexity: "complex",
      structuredDescTemplate: {
        summary: "Execute the refactoring of {{topic}} in safe, incremental steps",
        aiInstructions: "Follow the migration strategy. Ensure test coverage before changes. Make small commits. Run tests after each change. Use spectree__link_code_file for all modified files.",
        acceptanceCriteria: [
          "Test coverage in place before changes",
          "Refactoring completed in small commits",
          "Tests pass after each change",
          "All modified files linked",
          "Code review completed",
        ],
        riskLevel: "high",
        estimatedEffort: "large",
      },
      tasks: [
        {
          titleTemplate: "Ensure test coverage before changes",
          executionOrder: 1,
          estimatedComplexity: "moderate",
          structuredDescTemplate: {
            summary: "Ensure adequate test coverage before refactoring {{topic}}",
            aiInstructions: "Add tests for any untested code that will be modified. Tests should verify current behavior so we can detect regressions. Don't start refactoring without tests.",
            acceptanceCriteria: [
              "All code to be modified has tests",
              "Tests verify current behavior",
              "Coverage is adequate for safe refactoring",
            ],
          },
        },
        {
          titleTemplate: "Apply refactoring in small commits",
          executionOrder: 2,
          estimatedComplexity: "moderate",
          structuredDescTemplate: {
            summary: "Apply refactoring changes to {{topic}} in small, focused commits",
            aiInstructions: "Follow the migration strategy step by step. Each commit should be small and focused. Commit messages should explain the refactoring step. Keep the code working.",
            acceptanceCriteria: [
              "Changes are incremental",
              "Each commit is focused",
              "Commit messages are clear",
              "Code works at each step",
            ],
          },
        },
        {
          titleTemplate: "Run tests after each change",
          executionOrder: 3,
          estimatedComplexity: "trivial",
          structuredDescTemplate: {
            summary: "Run tests after each refactoring change to {{topic}}",
            aiInstructions: "Run tests after each commit. If tests fail, fix immediately or revert. Don't accumulate broken tests. This ensures we catch regressions early.",
            acceptanceCriteria: [
              "Tests run after each commit",
              "Failures addressed immediately",
              "No accumulated failures",
            ],
          },
        },
        {
          titleTemplate: "Code review",
          executionOrder: 4,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Review refactored {{topic}} code",
            aiInstructions: "Review the refactored code for quality. Verify it meets the target architecture. Check for any missed improvements. Ensure style consistency.",
            acceptanceCriteria: [
              "Code meets target architecture",
              "Quality standards met",
              "Style is consistent",
            ],
          },
        },
      ],
    },
    {
      titleTemplate: "Validate: {{topic}}",
      descriptionPrompt: "Validate refactoring success",
      executionOrder: 4,
      canParallelize: false,
      estimatedComplexity: "simple",
      structuredDescTemplate: {
        summary: "Validate the refactoring of {{topic}} was successful",
        aiInstructions: "Run full test suite. Perform performance testing if applicable. Document the improvements achieved. Compare before/after metrics if available.",
        acceptanceCriteria: [
          "Full test suite passes",
          "Performance is not degraded",
          "Improvements documented",
          "Technical debt reduced",
        ],
        riskLevel: "low",
        estimatedEffort: "small",
      },
      tasks: [
        {
          titleTemplate: "Run full test suite",
          executionOrder: 1,
          estimatedComplexity: "trivial",
          structuredDescTemplate: {
            summary: "Run full test suite for {{topic}}",
            aiInstructions: "Run the complete test suite. All tests should pass. Investigate any failures thoroughly.",
            acceptanceCriteria: [
              "All tests pass",
              "No regressions",
              "Test coverage maintained",
            ],
          },
        },
        {
          titleTemplate: "Performance testing",
          executionOrder: 2,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Verify performance of refactored {{topic}}",
            aiInstructions: "Run performance benchmarks if applicable. Compare with pre-refactoring metrics. Ensure performance is not degraded. Document any improvements.",
            acceptanceCriteria: [
              "Performance benchmarked",
              "No performance degradation",
              "Results documented",
            ],
          },
        },
        {
          titleTemplate: "Document improvements",
          executionOrder: 3,
          estimatedComplexity: "trivial",
          structuredDescTemplate: {
            summary: "Document the improvements from refactoring {{topic}}",
            aiInstructions: "Summarize what was improved: code quality, maintainability, performance. Document for future reference. Use spectree__append_ai_note.",
            acceptanceCriteria: [
              "Improvements summarized",
              "Before/after comparison documented",
              "Lessons learned noted",
            ],
          },
        },
      ],
    },
  ],
};

// =============================================================================
// API Endpoint Template (Enhanced)
// =============================================================================

const apiEndpointTemplate: TemplateStructure = {
  epicDefaults: {
    icon: "🔌",
    color: "#10b981",
    descriptionPrompt: "API Endpoint: {{topic}}",
  },
  features: [
    {
      titleTemplate: "Design API: {{topic}}",
      descriptionPrompt: "Design the API contract and data models",
      executionOrder: 1,
      canParallelize: false,
      estimatedComplexity: "moderate",
      structuredDescTemplate: {
        summary: "Design the API contract for {{topic}} including request/response schemas and error handling",
        aiInstructions: "Define OpenAPI/Swagger schemas. Design request validation. Plan error responses with proper HTTP status codes. Consider pagination, filtering if applicable. Use spectree__log_decision for API design choices.",
        acceptanceCriteria: [
          "Request schema defined with validation rules",
          "Response schema defined",
          "Error responses documented with HTTP codes",
          "API design decisions logged",
        ],
        riskLevel: "medium",
        estimatedEffort: "medium",
      },
      tasks: [
        {
          titleTemplate: "Define request/response schemas",
          executionOrder: 1,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Define request and response schemas for {{topic}} API",
            aiInstructions: "Create Zod schemas or TypeScript interfaces for request and response. Include all fields with proper types. Add validation rules (required, min/max, patterns). Document each field.",
            acceptanceCriteria: [
              "Request schema created",
              "Response schema created",
              "Validation rules defined",
              "Fields documented",
            ],
          },
        },
        {
          titleTemplate: "Design error responses",
          executionOrder: 2,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Design error responses for {{topic}} API",
            aiInstructions: "Define error response format following project conventions. Map error types to HTTP status codes (400 for validation, 401/403 for auth, 404 for not found, 500 for server errors). Include error codes and messages.",
            acceptanceCriteria: [
              "Error format defined",
              "HTTP status codes mapped",
              "Error codes defined",
              "User-friendly messages",
            ],
          },
        },
        {
          titleTemplate: "Review with API consumers",
          executionOrder: 3,
          estimatedComplexity: "trivial",
          structuredDescTemplate: {
            summary: "Validate {{topic}} API design",
            aiInstructions: "Review the API design for usability. Check consistency with existing APIs. Verify the design meets requirements. Document any assumptions.",
            acceptanceCriteria: [
              "Design reviewed",
              "Consistent with existing APIs",
              "Requirements met",
              "Assumptions documented",
            ],
          },
        },
      ],
    },
    {
      titleTemplate: "Implement Route: {{topic}}",
      descriptionPrompt: "Implement the API route and business logic",
      executionOrder: 2,
      canParallelize: false,
      estimatedComplexity: "complex",
      structuredDescTemplate: {
        summary: "Implement the {{topic}} API route with validation, business logic, and auth",
        aiInstructions: "Follow existing route patterns in the codebase. Implement request validation first. Add authentication/authorization checks. Implement business logic in service layer. Use spectree__link_code_file for all files.",
        acceptanceCriteria: [
          "Route handler created",
          "Request validation implemented",
          "Business logic in service layer",
          "Auth checks in place",
          "All files linked",
        ],
        riskLevel: "medium",
        estimatedEffort: "large",
      },
      tasks: [
        {
          titleTemplate: "Create route handler",
          executionOrder: 1,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Create the route handler for {{topic}}",
            aiInstructions: "Add the route to the appropriate router file. Follow existing patterns for route definition. Set up the basic handler structure. Add to route index if needed.",
            acceptanceCriteria: [
              "Route added to router",
              "Handler structure created",
              "Follows existing patterns",
              "Route registered",
            ],
          },
        },
        {
          titleTemplate: "Implement validation",
          executionOrder: 2,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Implement request validation for {{topic}}",
            aiInstructions: "Use the schemas defined in design phase. Add validation middleware or inline validation. Return 400 with clear error messages on validation failure.",
            acceptanceCriteria: [
              "Validation middleware added",
              "All fields validated",
              "Clear error messages",
              "Returns 400 on failure",
            ],
          },
        },
        {
          titleTemplate: "Implement business logic",
          executionOrder: 3,
          estimatedComplexity: "moderate",
          structuredDescTemplate: {
            summary: "Implement business logic for {{topic}}",
            aiInstructions: "Implement in a service layer, not in the route handler. Handle all business rules. Return appropriate data or throw typed errors. Consider transactions if needed.",
            acceptanceCriteria: [
              "Logic in service layer",
              "Business rules implemented",
              "Proper error handling",
              "Transactions if needed",
            ],
          },
        },
        {
          titleTemplate: "Add authentication/authorization",
          executionOrder: 4,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Add auth to {{topic}} endpoint",
            aiInstructions: "Add authentication middleware. Implement authorization checks (who can access). Return 401 for unauthenticated, 403 for unauthorized. Follow existing auth patterns.",
            acceptanceCriteria: [
              "Auth middleware added",
              "Authorization checks implemented",
              "Proper 401/403 responses",
              "Follows auth patterns",
            ],
          },
        },
      ],
    },
    {
      titleTemplate: "Test API: {{topic}}",
      descriptionPrompt: "Comprehensive API testing",
      executionOrder: 3,
      canParallelize: false,
      estimatedComplexity: "moderate",
      structuredDescTemplate: {
        summary: "Write comprehensive tests for {{topic}} API including happy paths, errors, and edge cases",
        aiInstructions: "Write integration tests that test the full request/response cycle. Test authentication, validation, business logic, and error handling. Follow existing test patterns.",
        acceptanceCriteria: [
          "Integration tests for happy paths",
          "Auth scenarios tested",
          "Validation errors tested",
          "Edge cases covered",
          "All tests pass",
        ],
        riskLevel: "low",
        estimatedEffort: "medium",
      },
      tasks: [
        {
          titleTemplate: "Write integration tests",
          executionOrder: 1,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Write integration tests for {{topic}} API",
            aiInstructions: "Test the full HTTP request/response cycle. Include authentication setup. Test successful responses. Use existing test utilities and patterns.",
            acceptanceCriteria: [
              "Tests use real HTTP requests",
              "Auth properly set up",
              "Happy paths covered",
              "Follows test patterns",
            ],
          },
        },
        {
          titleTemplate: "Test error scenarios",
          executionOrder: 2,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Test error scenarios for {{topic}} API",
            aiInstructions: "Test: validation errors (400), auth failures (401), permission denied (403), not found (404), server errors (500). Verify error response format and messages.",
            acceptanceCriteria: [
              "All error codes tested",
              "Error format verified",
              "Error messages checked",
            ],
          },
        },
        {
          titleTemplate: "Test edge cases and limits",
          executionOrder: 3,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Test edge cases for {{topic}} API",
            aiInstructions: "Test: empty inputs, max-length inputs, special characters, pagination boundaries, concurrent requests if applicable. Verify graceful handling.",
            acceptanceCriteria: [
              "Edge cases identified",
              "Boundary conditions tested",
              "Graceful handling verified",
            ],
          },
        },
      ],
    },
    {
      titleTemplate: "Document API: {{topic}}",
      descriptionPrompt: "API documentation",
      executionOrder: 4,
      canParallelize: false,
      estimatedComplexity: "simple",
      structuredDescTemplate: {
        summary: "Document the {{topic}} API with OpenAPI spec, examples, and changelog",
        aiInstructions: "Add OpenAPI/Swagger documentation. Include request/response examples. Document error responses. Update API changelog. Make documentation developer-friendly.",
        acceptanceCriteria: [
          "OpenAPI spec added",
          "Examples included",
          "Errors documented",
          "Changelog updated",
        ],
        riskLevel: "low",
        estimatedEffort: "small",
      },
      tasks: [
        {
          titleTemplate: "Add OpenAPI/Swagger documentation",
          executionOrder: 1,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Add OpenAPI documentation for {{topic}}",
            aiInstructions: "Add OpenAPI decorators or update OpenAPI spec file. Include all request/response schemas. Document parameters, headers, and auth requirements.",
            acceptanceCriteria: [
              "OpenAPI spec complete",
              "All schemas documented",
              "Auth requirements noted",
            ],
          },
        },
        {
          titleTemplate: "Create usage examples",
          executionOrder: 2,
          estimatedComplexity: "trivial",
          structuredDescTemplate: {
            summary: "Create usage examples for {{topic}} API",
            aiInstructions: "Add curl examples or code snippets. Show common use cases. Include error handling examples. Make examples copy-paste ready.",
            acceptanceCriteria: [
              "Examples added",
              "Common cases covered",
              "Examples are runnable",
            ],
          },
        },
        {
          titleTemplate: "Update API changelog",
          executionOrder: 3,
          estimatedComplexity: "trivial",
          structuredDescTemplate: {
            summary: "Update changelog for {{topic}} API",
            aiInstructions: "Add entry to API changelog if one exists. Include date, endpoint, and description. Note any breaking changes. Follow changelog format.",
            acceptanceCriteria: [
              "Changelog updated",
              "Entry is complete",
              "Breaking changes noted",
            ],
          },
        },
      ],
    },
  ],
};

// =============================================================================
// NEW: Frontend Component Template
// =============================================================================

const frontendComponentTemplate: TemplateStructure = {
  epicDefaults: {
    icon: "🎨",
    color: "#f59e0b",
    descriptionPrompt: "Frontend Component: {{topic}}",
  },
  features: [
    {
      titleTemplate: "Design: {{topic}} Component",
      descriptionPrompt: "Design the component interface, props, and state",
      executionOrder: 1,
      canParallelize: false,
      estimatedComplexity: "simple",
      structuredDescTemplate: {
        summary: "Design the {{topic}} component including props interface, state management, and component structure",
        aiInstructions: "Define TypeScript props interface. Plan component state (local vs global). Design component hierarchy. Check for existing similar components to maintain consistency.",
        acceptanceCriteria: [
          "Props interface defined",
          "State management approach decided",
          "Component hierarchy planned",
          "Consistent with existing components",
        ],
        riskLevel: "low",
        estimatedEffort: "small",
      },
      tasks: [
        {
          titleTemplate: "Define props and types",
          executionOrder: 1,
          estimatedComplexity: "trivial",
          structuredDescTemplate: {
            summary: "Define TypeScript interface for {{topic}} props",
            aiInstructions: "Create props interface with proper types. Include all configurable properties. Add JSDoc comments. Consider required vs optional props.",
            acceptanceCriteria: [
              "Props interface created",
              "All props typed",
              "JSDoc comments added",
            ],
          },
        },
        {
          titleTemplate: "Plan state management",
          executionOrder: 2,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Plan state management for {{topic}}",
            aiInstructions: "Decide: local state (useState), context, or global store. Consider what state is truly needed. Plan data flow. Document state management decision.",
            acceptanceCriteria: [
              "State approach decided",
              "Data flow planned",
              "Decision documented",
            ],
          },
        },
        {
          titleTemplate: "Design component structure",
          executionOrder: 3,
          estimatedComplexity: "trivial",
          structuredDescTemplate: {
            summary: "Design component structure for {{topic}}",
            aiInstructions: "Plan subcomponents if needed. Design the component tree. Consider reusability. Keep components focused and single-purpose.",
            acceptanceCriteria: [
              "Component tree planned",
              "Subcomponents identified",
              "Components are focused",
            ],
          },
        },
      ],
    },
    {
      titleTemplate: "Implement: {{topic}} Component",
      descriptionPrompt: "Build the component with proper styling and accessibility",
      executionOrder: 2,
      canParallelize: false,
      estimatedComplexity: "moderate",
      structuredDescTemplate: {
        summary: "Implement the {{topic}} component with styling, accessibility, and proper React patterns",
        aiInstructions: "Follow React best practices. Use existing UI components/design system. Ensure accessibility (ARIA, keyboard nav). Follow existing styling patterns (CSS modules, Tailwind, etc).",
        acceptanceCriteria: [
          "Component implemented",
          "Uses design system/UI library",
          "Accessible (ARIA, keyboard)",
          "Follows styling patterns",
          "No console errors/warnings",
        ],
        riskLevel: "medium",
        estimatedEffort: "medium",
      },
      tasks: [
        {
          titleTemplate: "Create base component",
          executionOrder: 1,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Create the base {{topic}} component",
            aiInstructions: "Create component file in correct location. Implement basic structure and props. Follow naming conventions. Export from index file.",
            acceptanceCriteria: [
              "Component file created",
              "Props implemented",
              "Exported correctly",
            ],
          },
        },
        {
          titleTemplate: "Add styling",
          executionOrder: 2,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Style the {{topic}} component",
            aiInstructions: "Use existing styling approach (check other components). Ensure responsive design. Follow design system tokens/variables. Keep styles maintainable.",
            acceptanceCriteria: [
              "Styles applied",
              "Responsive design",
              "Uses design tokens",
              "Maintainable styles",
            ],
          },
        },
        {
          titleTemplate: "Implement accessibility",
          executionOrder: 3,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Make {{topic}} accessible",
            aiInstructions: "Add ARIA labels/roles where needed. Ensure keyboard navigation. Test with screen reader if possible. Check color contrast. Handle focus management.",
            acceptanceCriteria: [
              "ARIA attributes added",
              "Keyboard navigable",
              "Proper focus handling",
              "Color contrast OK",
            ],
          },
        },
        {
          titleTemplate: "Handle edge cases",
          executionOrder: 4,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Handle edge cases in {{topic}}",
            aiInstructions: "Handle: loading states, empty states, error states, long text, missing data. Add appropriate fallbacks. Test each state visually.",
            acceptanceCriteria: [
              "Loading state handled",
              "Empty state handled",
              "Error state handled",
              "Edge cases covered",
            ],
          },
        },
      ],
    },
    {
      titleTemplate: "Test: {{topic}} Component",
      descriptionPrompt: "Write unit tests and visual tests",
      executionOrder: 3,
      canParallelize: false,
      estimatedComplexity: "simple",
      structuredDescTemplate: {
        summary: "Write comprehensive tests for {{topic}} component",
        aiInstructions: "Write unit tests with Testing Library. Test user interactions. Test accessibility. Add snapshot or visual tests if applicable. Follow existing test patterns.",
        acceptanceCriteria: [
          "Unit tests written",
          "Interactions tested",
          "Accessibility tested",
          "All tests pass",
        ],
        riskLevel: "low",
        estimatedEffort: "small",
      },
      tasks: [
        {
          titleTemplate: "Write unit tests",
          executionOrder: 1,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Write unit tests for {{topic}}",
            aiInstructions: "Use React Testing Library. Test rendering with different props. Test conditional rendering. Follow existing test patterns in the codebase.",
            acceptanceCriteria: [
              "Renders correctly tested",
              "Props behavior tested",
              "Conditional rendering tested",
            ],
          },
        },
        {
          titleTemplate: "Test interactions",
          executionOrder: 2,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Test user interactions for {{topic}}",
            aiInstructions: "Test: clicks, input changes, form submissions, keyboard events. Use userEvent for realistic interactions. Test callbacks are called correctly.",
            acceptanceCriteria: [
              "Click handlers tested",
              "Form interactions tested",
              "Callbacks verified",
            ],
          },
        },
        {
          titleTemplate: "Test accessibility",
          executionOrder: 3,
          estimatedComplexity: "trivial",
          structuredDescTemplate: {
            summary: "Test accessibility for {{topic}}",
            aiInstructions: "Use jest-axe or similar for automated a11y testing. Test keyboard navigation works. Verify ARIA attributes are correct.",
            acceptanceCriteria: [
              "Automated a11y tests pass",
              "Keyboard nav works",
              "ARIA verified",
            ],
          },
        },
      ],
    },
    {
      titleTemplate: "Document: {{topic}} Component",
      descriptionPrompt: "Add Storybook stories and documentation",
      executionOrder: 4,
      canParallelize: false,
      estimatedComplexity: "trivial",
      structuredDescTemplate: {
        summary: "Document the {{topic}} component with Storybook stories and usage examples",
        aiInstructions: "Add Storybook stories if using Storybook. Document all props. Add usage examples. Include do's and don'ts if applicable.",
        acceptanceCriteria: [
          "Storybook stories added",
          "Props documented",
          "Usage examples provided",
        ],
        riskLevel: "low",
        estimatedEffort: "trivial",
      },
      tasks: [
        {
          titleTemplate: "Add Storybook stories",
          executionOrder: 1,
          estimatedComplexity: "trivial",
          structuredDescTemplate: {
            summary: "Add Storybook stories for {{topic}}",
            aiInstructions: "Create stories file next to component. Add stories for all variants. Include interactive controls. Show different states (loading, error, etc).",
            acceptanceCriteria: [
              "Stories file created",
              "All variants shown",
              "Controls added",
              "States demonstrated",
            ],
          },
        },
        {
          titleTemplate: "Document component usage",
          executionOrder: 2,
          estimatedComplexity: "trivial",
          structuredDescTemplate: {
            summary: "Document how to use {{topic}}",
            aiInstructions: "Add JSDoc to component and props. Include usage examples in comments or README. Document any gotchas or important notes.",
            acceptanceCriteria: [
              "JSDoc added",
              "Examples provided",
              "Gotchas documented",
            ],
          },
        },
      ],
    },
  ],
};

// =============================================================================
// NEW: Database Migration Template
// =============================================================================

const databaseMigrationTemplate: TemplateStructure = {
  epicDefaults: {
    icon: "🗄️",
    color: "#6366f1",
    descriptionPrompt: "Database Migration: {{topic}}",
  },
  features: [
    {
      titleTemplate: "Design Schema: {{topic}}",
      descriptionPrompt: "Design the database schema changes",
      executionOrder: 1,
      canParallelize: false,
      estimatedComplexity: "moderate",
      structuredDescTemplate: {
        summary: "Design the schema changes for {{topic}} including tables, columns, indexes, and constraints",
        aiInstructions: "Design the schema changes carefully. Consider: data types, nullable fields, defaults, indexes, foreign keys, constraints. Plan for rollback. Use spectree__log_decision for schema choices.",
        acceptanceCriteria: [
          "Schema changes designed",
          "Data types chosen appropriately",
          "Indexes planned",
          "Constraints defined",
          "Rollback strategy planned",
        ],
        riskLevel: "high",
        estimatedEffort: "medium",
      },
      tasks: [
        {
          titleTemplate: "Design table/column changes",
          executionOrder: 1,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Design table and column changes for {{topic}}",
            aiInstructions: "Define new tables, columns, or modifications. Choose appropriate data types. Consider nullable vs required. Plan default values. Follow existing naming conventions.",
            acceptanceCriteria: [
              "Tables/columns defined",
              "Data types appropriate",
              "Naming follows conventions",
            ],
          },
        },
        {
          titleTemplate: "Plan indexes and constraints",
          executionOrder: 2,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Plan indexes and constraints for {{topic}}",
            aiInstructions: "Identify columns needing indexes (foreign keys, frequently queried). Define unique constraints. Plan foreign key relationships. Consider performance implications.",
            acceptanceCriteria: [
              "Indexes identified",
              "Constraints defined",
              "Foreign keys planned",
              "Performance considered",
            ],
          },
        },
        {
          titleTemplate: "Plan data migration",
          executionOrder: 3,
          estimatedComplexity: "moderate",
          structuredDescTemplate: {
            summary: "Plan data migration for {{topic}}",
            aiInstructions: "If existing data needs migration, plan carefully. Consider: data transformation, defaults for new required fields, handling of edge cases. Plan for large datasets.",
            acceptanceCriteria: [
              "Data migration planned",
              "Edge cases handled",
              "Large dataset strategy",
            ],
          },
        },
      ],
    },
    {
      titleTemplate: "Implement Migration: {{topic}}",
      descriptionPrompt: "Create the migration files safely",
      executionOrder: 2,
      canParallelize: false,
      estimatedComplexity: "moderate",
      structuredDescTemplate: {
        summary: "Create migration files for {{topic}} with up/down migrations",
        aiInstructions: "🔴 NEVER use: prisma migrate reset, prisma migrate dev, or db push --force-reset. Create migration files manually or use prisma migrate dev --create-only. Always include rollback migration.",
        acceptanceCriteria: [
          "Migration file created",
          "Up migration works",
          "Down/rollback migration works",
          "No destructive commands used",
        ],
        riskLevel: "high",
        estimatedEffort: "medium",
      },
      tasks: [
        {
          titleTemplate: "Create migration file",
          executionOrder: 1,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Create migration file for {{topic}}",
            aiInstructions: "Use 'prisma migrate dev --create-only' to create migration file without applying. Or create SQL file manually. Name clearly. Include timestamp.",
            acceptanceCriteria: [
              "Migration file created",
              "Named clearly",
              "Not applied yet",
            ],
          },
        },
        {
          titleTemplate: "Write up migration",
          executionOrder: 2,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Write the up migration for {{topic}}",
            aiInstructions: "Write SQL for forward migration. Handle existing data appropriately. Add indexes after data migration if large table. Test syntax locally.",
            acceptanceCriteria: [
              "Up migration written",
              "Handles existing data",
              "Syntax verified",
            ],
          },
        },
        {
          titleTemplate: "Write down/rollback migration",
          executionOrder: 3,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Write rollback migration for {{topic}}",
            aiInstructions: "Write SQL to undo the migration. Consider: can data be restored? Document any data loss. Rollback should be safe to run.",
            acceptanceCriteria: [
              "Rollback migration written",
              "Data loss documented if any",
              "Safe to execute",
            ],
          },
        },
      ],
    },
    {
      titleTemplate: "Test Migration: {{topic}}",
      descriptionPrompt: "Test the migration thoroughly",
      executionOrder: 3,
      canParallelize: false,
      estimatedComplexity: "moderate",
      structuredDescTemplate: {
        summary: "Test {{topic}} migration including up, down, and data integrity",
        aiInstructions: "Test migration on a copy of production data if possible. Verify up migration works. Verify down migration works. Check data integrity. Test with realistic data volumes.",
        acceptanceCriteria: [
          "Up migration tested",
          "Down migration tested",
          "Data integrity verified",
          "Tested with realistic data",
        ],
        riskLevel: "high",
        estimatedEffort: "medium",
      },
      tasks: [
        {
          titleTemplate: "Test up migration",
          executionOrder: 1,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Test up migration for {{topic}}",
            aiInstructions: "Apply migration to test database. Verify schema changes applied correctly. Check existing data is preserved. Test with various data scenarios.",
            acceptanceCriteria: [
              "Migration applies cleanly",
              "Schema correct",
              "Data preserved",
            ],
          },
        },
        {
          titleTemplate: "Test down migration",
          executionOrder: 2,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Test rollback for {{topic}}",
            aiInstructions: "Apply rollback migration. Verify schema returns to previous state. Check for any data loss. Ensure application still works after rollback.",
            acceptanceCriteria: [
              "Rollback works",
              "Schema restored",
              "App works after rollback",
            ],
          },
        },
        {
          titleTemplate: "Verify data integrity",
          executionOrder: 3,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Verify data integrity after {{topic}} migration",
            aiInstructions: "Run queries to verify data correctness. Check foreign key relationships. Verify no orphaned records. Compare row counts before/after.",
            acceptanceCriteria: [
              "Data correct",
              "Relationships intact",
              "No orphans",
              "Counts verified",
            ],
          },
        },
      ],
    },
    {
      titleTemplate: "Update Code: {{topic}}",
      descriptionPrompt: "Update application code for schema changes",
      executionOrder: 4,
      canParallelize: false,
      estimatedComplexity: "moderate",
      structuredDescTemplate: {
        summary: "Update application code to work with {{topic}} schema changes",
        aiInstructions: "Update Prisma schema if using Prisma. Update TypeScript types. Update queries and services. Run 'prisma generate' to update client. Test all affected code paths.",
        acceptanceCriteria: [
          "Prisma schema updated",
          "Types updated",
          "Queries updated",
          "Client regenerated",
          "Code tests pass",
        ],
        riskLevel: "medium",
        estimatedEffort: "medium",
      },
      tasks: [
        {
          titleTemplate: "Update Prisma schema",
          executionOrder: 1,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Update Prisma schema for {{topic}}",
            aiInstructions: "Update schema.prisma to match migration. Run 'prisma generate' to update client. Do NOT run 'prisma migrate dev' - migration already created.",
            acceptanceCriteria: [
              "Schema.prisma updated",
              "Client generated",
              "No migrate dev run",
            ],
          },
        },
        {
          titleTemplate: "Update services and queries",
          executionOrder: 2,
          estimatedComplexity: "moderate",
          structuredDescTemplate: {
            summary: "Update services for {{topic}} changes",
            aiInstructions: "Update all services that interact with changed tables. Update queries to use new fields/tables. Remove references to dropped columns. Test each change.",
            acceptanceCriteria: [
              "Services updated",
              "Queries updated",
              "Old references removed",
            ],
          },
        },
        {
          titleTemplate: "Update tests",
          executionOrder: 3,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Update tests for {{topic}} changes",
            aiInstructions: "Update test fixtures/factories for new schema. Update test assertions. Add tests for new functionality. Ensure all tests pass.",
            acceptanceCriteria: [
              "Fixtures updated",
              "Assertions updated",
              "New tests added",
              "All tests pass",
            ],
          },
        },
      ],
    },
  ],
};

// =============================================================================
// NEW: Integration Template
// =============================================================================

const integrationTemplate: TemplateStructure = {
  epicDefaults: {
    icon: "🔗",
    color: "#ec4899",
    descriptionPrompt: "Integration: {{topic}}",
  },
  features: [
    {
      titleTemplate: "Research: {{topic}} Integration",
      descriptionPrompt: "Research the external service and plan integration",
      executionOrder: 1,
      canParallelize: false,
      estimatedComplexity: "simple",
      structuredDescTemplate: {
        summary: "Research {{topic}} API/service and plan the integration approach",
        aiInstructions: "Read the service documentation. Understand authentication requirements. Identify rate limits. Plan error handling. Check for existing SDKs. Use spectree__add_external_link to save docs.",
        acceptanceCriteria: [
          "API documentation reviewed",
          "Auth requirements understood",
          "Rate limits identified",
          "SDK options evaluated",
          "Integration approach planned",
        ],
        riskLevel: "low",
        estimatedEffort: "small",
      },
      tasks: [
        {
          titleTemplate: "Review API documentation",
          executionOrder: 1,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Review {{topic}} API documentation",
            aiInstructions: "Read through API docs thoroughly. Note endpoints needed. Understand request/response formats. Identify any quirks or gotchas. Save doc links.",
            acceptanceCriteria: [
              "Docs reviewed",
              "Endpoints identified",
              "Formats understood",
              "Links saved",
            ],
          },
        },
        {
          titleTemplate: "Understand auth and security",
          executionOrder: 2,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Understand {{topic}} authentication requirements",
            aiInstructions: "Identify auth method (API key, OAuth, JWT). Understand token refresh if applicable. Plan secure credential storage. Note any IP restrictions.",
            acceptanceCriteria: [
              "Auth method identified",
              "Token handling planned",
              "Credential storage planned",
            ],
          },
        },
        {
          titleTemplate: "Plan integration architecture",
          executionOrder: 3,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Plan architecture for {{topic}} integration",
            aiInstructions: "Design service/client structure. Plan retry logic. Design error handling. Consider circuit breaker pattern. Plan caching if applicable. Log decisions.",
            acceptanceCriteria: [
              "Service structure planned",
              "Retry logic designed",
              "Error handling designed",
              "Decisions logged",
            ],
          },
        },
      ],
    },
    {
      titleTemplate: "Implement: {{topic}} Client",
      descriptionPrompt: "Build the integration client/service",
      executionOrder: 2,
      canParallelize: false,
      estimatedComplexity: "complex",
      structuredDescTemplate: {
        summary: "Implement the {{topic}} integration client with auth, retries, and error handling",
        aiInstructions: "Create a dedicated client/service for the integration. Implement authentication. Add retry logic with exponential backoff. Handle all error cases. Use environment variables for config.",
        acceptanceCriteria: [
          "Client/service created",
          "Authentication implemented",
          "Retry logic with backoff",
          "Comprehensive error handling",
          "Config in environment variables",
        ],
        riskLevel: "medium",
        estimatedEffort: "large",
      },
      tasks: [
        {
          titleTemplate: "Create client service",
          executionOrder: 1,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Create {{topic}} client service",
            aiInstructions: "Create a new service file. Set up HTTP client (axios, fetch, etc). Configure base URL and headers. Add TypeScript types for requests/responses.",
            acceptanceCriteria: [
              "Service file created",
              "HTTP client configured",
              "Types defined",
            ],
          },
        },
        {
          titleTemplate: "Implement authentication",
          executionOrder: 2,
          estimatedComplexity: "moderate",
          structuredDescTemplate: {
            summary: "Implement {{topic}} authentication",
            aiInstructions: "Implement the auth method (API key header, OAuth flow, etc). Store credentials securely (env vars). Handle token refresh if needed. Never log credentials.",
            acceptanceCriteria: [
              "Auth implemented",
              "Credentials secure",
              "Token refresh handled",
            ],
          },
        },
        {
          titleTemplate: "Add retry logic",
          executionOrder: 3,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Add retry logic for {{topic}} requests",
            aiInstructions: "Implement exponential backoff for transient errors (5xx, network). Set max retries. Don't retry non-retryable errors (4xx). Log retry attempts.",
            acceptanceCriteria: [
              "Exponential backoff implemented",
              "Max retries configured",
              "Non-retryable excluded",
              "Retries logged",
            ],
          },
        },
        {
          titleTemplate: "Handle errors",
          executionOrder: 4,
          estimatedComplexity: "moderate",
          structuredDescTemplate: {
            summary: "Implement error handling for {{topic}}",
            aiInstructions: "Create typed errors for different failure modes. Handle rate limiting (429). Handle auth failures (401). Map external errors to internal error types. Include context in errors.",
            acceptanceCriteria: [
              "Typed errors created",
              "Rate limiting handled",
              "Auth failures handled",
              "Errors have context",
            ],
          },
        },
      ],
    },
    {
      titleTemplate: "Test: {{topic}} Integration",
      descriptionPrompt: "Test the integration thoroughly",
      executionOrder: 3,
      canParallelize: false,
      estimatedComplexity: "moderate",
      structuredDescTemplate: {
        summary: "Write comprehensive tests for {{topic}} integration including mocks and error scenarios",
        aiInstructions: "Write unit tests with mocked responses. Test error handling. Test retry logic. Consider integration tests with sandbox/test environment if available.",
        acceptanceCriteria: [
          "Unit tests with mocks",
          "Error scenarios tested",
          "Retry logic tested",
          "Integration tests if sandbox available",
        ],
        riskLevel: "low",
        estimatedEffort: "medium",
      },
      tasks: [
        {
          titleTemplate: "Write unit tests with mocks",
          executionOrder: 1,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Write unit tests for {{topic}} client",
            aiInstructions: "Mock HTTP responses. Test successful requests. Test response parsing. Use realistic mock data. Follow existing mock patterns.",
            acceptanceCriteria: [
              "HTTP mocked",
              "Success cases tested",
              "Parsing tested",
              "Realistic data",
            ],
          },
        },
        {
          titleTemplate: "Test error scenarios",
          executionOrder: 2,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Test error scenarios for {{topic}}",
            aiInstructions: "Test: network failures, 4xx errors, 5xx errors, rate limiting, auth failures, malformed responses. Verify error messages are useful.",
            acceptanceCriteria: [
              "Network errors tested",
              "HTTP errors tested",
              "Rate limits tested",
              "Auth errors tested",
            ],
          },
        },
        {
          titleTemplate: "Test retry behavior",
          executionOrder: 3,
          estimatedComplexity: "simple",
          structuredDescTemplate: {
            summary: "Test retry behavior for {{topic}}",
            aiInstructions: "Test that retries happen on transient errors. Test max retries respected. Test that 4xx doesn't retry. Verify backoff timing.",
            acceptanceCriteria: [
              "Retries work",
              "Max respected",
              "4xx not retried",
              "Backoff correct",
            ],
          },
        },
      ],
    },
    {
      titleTemplate: "Document: {{topic}} Integration",
      descriptionPrompt: "Document the integration setup and usage",
      executionOrder: 4,
      canParallelize: false,
      estimatedComplexity: "simple",
      structuredDescTemplate: {
        summary: "Document {{topic}} integration including setup, configuration, and troubleshooting",
        aiInstructions: "Document required environment variables. Add setup instructions. Include usage examples. Document error handling. Add troubleshooting guide.",
        acceptanceCriteria: [
          "Env vars documented",
          "Setup instructions clear",
          "Usage examples provided",
          "Troubleshooting guide added",
        ],
        riskLevel: "low",
        estimatedEffort: "small",
      },
      tasks: [
        {
          titleTemplate: "Document configuration",
          executionOrder: 1,
          estimatedComplexity: "trivial",
          structuredDescTemplate: {
            summary: "Document {{topic}} configuration",
            aiInstructions: "Document all environment variables needed. Include example values (not real credentials). Document optional vs required config. Update .env.example.",
            acceptanceCriteria: [
              "Env vars documented",
              "Examples provided",
              "Required/optional clear",
              ".env.example updated",
            ],
          },
        },
        {
          titleTemplate: "Add usage examples",
          executionOrder: 2,
          estimatedComplexity: "trivial",
          structuredDescTemplate: {
            summary: "Add usage examples for {{topic}}",
            aiInstructions: "Add code examples showing how to use the client. Include common use cases. Show error handling. Make examples copy-paste ready.",
            acceptanceCriteria: [
              "Examples added",
              "Common cases covered",
              "Error handling shown",
            ],
          },
        },
        {
          titleTemplate: "Create troubleshooting guide",
          executionOrder: 3,
          estimatedComplexity: "trivial",
          structuredDescTemplate: {
            summary: "Create troubleshooting guide for {{topic}}",
            aiInstructions: "Document common errors and solutions. Include debugging tips. Add links to external service status page. Document how to test connectivity.",
            acceptanceCriteria: [
              "Common errors documented",
              "Solutions provided",
              "Debugging tips included",
            ],
          },
        },
      ],
    },
  ],
};

// =============================================================================
// Export all templates
// =============================================================================

export const BUILT_IN_TEMPLATES = [
  {
    name: "Code Feature",
    description: "Standard software feature implementation workflow: Research → Design → Implementation → Testing → Documentation. Includes comprehensive AI instructions and acceptance criteria for each phase.",
    structure: JSON.stringify(codeFeatureTemplate),
  },
  {
    name: "Bug Fix",
    description: "Bug investigation and fix workflow: Reproduce → Investigate → Fix → Verify. Includes detailed guidance for root cause analysis and regression testing.",
    structure: JSON.stringify(bugFixTemplate),
  },
  {
    name: "Refactoring",
    description: "Code refactoring project: Analyze → Plan → Execute → Validate. Emphasizes safety with test coverage and incremental changes.",
    structure: JSON.stringify(refactoringTemplate),
  },
  {
    name: "API Endpoint",
    description: "New API endpoint development: Design → Implement → Test → Document. Covers request/response schemas, auth, validation, and OpenAPI documentation.",
    structure: JSON.stringify(apiEndpointTemplate),
  },
  {
    name: "Frontend Component",
    description: "React/UI component development: Design → Implement → Test → Document. Covers props, state, accessibility, styling, and Storybook stories.",
    structure: JSON.stringify(frontendComponentTemplate),
  },
  {
    name: "Database Migration",
    description: "Database schema change workflow: Design → Implement → Test → Update Code. Emphasizes safety with rollback plans and data integrity checks. 🔴 Never uses destructive commands.",
    structure: JSON.stringify(databaseMigrationTemplate),
  },
  {
    name: "Integration",
    description: "Third-party service integration: Research → Implement Client → Test → Document. Covers authentication, retry logic, error handling, and rate limiting.",
    structure: JSON.stringify(integrationTemplate),
  },
];
