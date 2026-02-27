/**
 * Seed script for the Laws Registry
 *
 * Populates the laws table with enforceable rules extracted from
 * .github/agents/*.md agent instruction files.
 *
 * Usage: npx tsx prisma/seed-laws.ts
 */

import { PrismaClient } from "../src/generated/prisma/index.js";

const prisma = new PrismaClient();

interface LawSeed {
  lawCode: string;
  title: string;
  description: string;
  severity: "minor" | "major" | "critical";
  auditLogic: string;
  consequence: string;
  appliesTo: string;
}

const laws: LawSeed[] = [
  {
    lawCode: "LAW-001",
    title: "Epic Description Hard Floor Score",
    description:
      "Epic descriptions must score >= 80 on the Epic Description Rubric before pipeline advancement. " +
      "This is the #1 quality gate — weak epic descriptions are the primary failure mode for downstream agents.",
    severity: "critical",
    auditLogic:
      "Query epic structured descriptions via spectree__get_epic. Check if epic has been reviewed " +
      "and scored. Verify plan-reviewer verdict does not contain approval with score < 80. " +
      "Cross-reference with AI session notes for scoring records.",
    consequence:
      "Epic is blocked from execution. Planner must revise description until score >= 80. " +
      "No exceptions or overrides permitted.",
    appliesTo: "planner",
  },
  {
    lawCode: "LAW-002",
    title: "Structured Descriptions Required for All Work Items",
    description:
      "Every feature and every task must have structured descriptions set via dispatcher__manage_description. " +
      "Each must include: summary, aiInstructions, acceptanceCriteria (3+), filesInvolved, riskLevel, estimatedEffort.",
    severity: "critical",
    auditLogic:
      "Query all features/tasks under the epic via spectree__list_features and spectree__list_tasks. " +
      "Check structuredDesc field is non-null and contains required sections. " +
      "Verify acceptanceCriteria array has >= 3 items per feature/task.",
    consequence:
      "Features/tasks without structured descriptions cannot proceed to execution. " +
      "Planner must complete all descriptions before handoff.",
    appliesTo: "planner",
  },
  {
    lawCode: "LAW-003",
    title: "Destructive Prisma Commands Forbidden",
    description:
      "Never run destructive Prisma commands: prisma migrate dev, prisma migrate reset, " +
      "prisma db push --force-reset. Only safe commands allowed: npx prisma db push, npx prisma generate.",
    severity: "critical",
    auditLogic:
      "Audit shell command history in AI session events. Search for forbidden command patterns: " +
      "'migrate dev', 'migrate reset', 'db push --force-reset'. Check session event payloads for " +
      "command execution records.",
    consequence:
      "Immediate session termination. Database may require recovery from backup. " +
      "Agent is flagged for safety review. Incident must be reported.",
    appliesTo: "orchestrator",
  },
  {
    lawCode: "LAW-004",
    title: "Task Must Be Marked In Progress Before Work Begins",
    description:
      "Agents must call dispatcher__manage_progress (action='start_work') on each task before " +
      "implementing it. This ensures the dashboard reflects real-time work status.",
    severity: "critical",
    auditLogic:
      "Compare task status change timestamps against git commit timestamps. Verify that task " +
      "status transitions to 'In Progress' before any code changes are committed for that task. " +
      "Check dispatcher API call audit trail for start_work actions.",
    consequence:
      "Dashboard becomes blind to work in progress. Orchestrator cannot accurately track " +
      "execution state. Task completion may be rejected if no start_work record exists.",
    appliesTo: "feature-worker",
  },
  {
    lawCode: "LAW-005",
    title: "All Modified Files Must Be Linked via Code Context",
    description:
      "Every file created or modified during task implementation must be registered via " +
      "dispatcher__manage_code_context (action='link_file'). No unlinked files permitted.",
    severity: "critical",
    auditLogic:
      "Run git diff on the feature branch to identify all changed files. Compare against " +
      "the relatedFiles field on each task/feature via spectree__get_task. " +
      "Flag any files in git diff not present in code context links.",
    consequence:
      "Unlinked files create blind spots for reviewers and future sessions. " +
      "Task review is blocked until all modified files are linked.",
    appliesTo: "feature-worker",
  },
  {
    lawCode: "LAW-006",
    title: "Reconciliation Sweep Before Session End",
    description:
      "Orchestrator must run a full reconciliation pass over ALL features and tasks before " +
      "ending a session. Work must only be marked Done if actually performed. " +
      "Skipped work must remain in Backlog with reason noted.",
    severity: "critical",
    auditLogic:
      "Check AI session end events for reconciliation records. Verify that task/feature " +
      "statuses match actual code changes in git history. Cross-reference 'Done' status " +
      "with existence of corresponding commits and file modifications.",
    consequence:
      "Inaccurate project status corrupts planning for subsequent sessions. " +
      "Orchestrator must re-run reconciliation before session can close.",
    appliesTo: "orchestrator",
  },
  {
    lawCode: "LAW-007",
    title: "Run Validations Before Task Completion",
    description:
      "Feature workers must call dispatcher__manage_validations (action='run_all') before " +
      "marking any task as complete. Tasks with failing validations must not be marked Done.",
    severity: "critical",
    auditLogic:
      "Check validationChecks field on each completed task via spectree__get_task. " +
      "Verify run_all action was called (check session events). Compare validation " +
      "results timestamp against task completion timestamp.",
    consequence:
      "Task is reverted to In Progress. Feature worker must fix failing validations " +
      "before re-attempting completion.",
    appliesTo: "feature-worker",
  },
  {
    lawCode: "LAW-008",
    title: "Epic Description Minimum Length and Sections",
    description:
      "Epic descriptions must be >= 500 words and include all mandatory sections: Overview, " +
      "Source, Problem Statement, Goals, Proposed Approach, Scope, Execution Plan, " +
      "Technical Considerations, Success Criteria, plus 2 supporting sections.",
    severity: "major",
    auditLogic:
      "Fetch epic description via spectree__get_epic. Count words in description field. " +
      "Parse markdown headers to verify presence of all 9 mandatory sections. " +
      "Flag missing sections or word count < 500.",
    consequence:
      "Epic is returned to planner for revision. Cannot proceed to plan review " +
      "until minimum quality bar is met.",
    appliesTo: "planner",
  },
  {
    lawCode: "LAW-009",
    title: "Execution Summary Appended to Epic Description",
    description:
      "Orchestrator must append an 'Execution Complete' section to the epic description " +
      "with phase results table, verification metrics, artifacts, and files created/modified.",
    severity: "major",
    auditLogic:
      "After orchestrator session ends, check epic description for 'Execution Complete' section. " +
      "Verify it contains a results table, file lists, and verification metrics. " +
      "Compare listed files against actual git changes.",
    consequence:
      "Epic execution record is incomplete. Future sessions lack context about what was done. " +
      "Orchestrator must update description before session close.",
    appliesTo: "orchestrator",
  },
  {
    lawCode: "LAW-010",
    title: "Plan Reviewer Must Enforce Description Score Floor",
    description:
      "Plan reviewers must never approve an epic with an Epic Description Score below 80. " +
      "This is the hard floor regardless of other scoring dimensions.",
    severity: "critical",
    auditLogic:
      "Check plan review decisions via spectree__list_decisions (category='scope'). " +
      "Look for approval verdicts paired with scores. Cross-reference reported score " +
      "against actual description quality metrics.",
    consequence:
      "Approved epics with weak descriptions create cascading quality failures. " +
      "Plan reviewer is flagged and epic is returned for re-review.",
    appliesTo: "plan-reviewer",
  },
  {
    lawCode: "LAW-011",
    title: "Parent Feature Must Be Marked Done After All Tasks Complete",
    description:
      "After completing the last task in a feature, the feature worker must call " +
      "dispatcher__manage_progress (action='complete_work') on the parent feature.",
    severity: "critical",
    auditLogic:
      "Query features where all child tasks have status 'Done' but feature itself is not 'Done'. " +
      "Use spectree__list_tasks to check task statuses, then spectree__get_feature for parent. " +
      "Flag features with all tasks done but feature still in progress.",
    consequence:
      "Orchestrator cannot detect phase completion. Subsequent features may be blocked. " +
      "Feature worker must update feature status before moving on.",
    appliesTo: "feature-worker",
  },
  {
    lawCode: "LAW-012",
    title: "Task Scope Must Fit Session Context",
    description:
      "No single task should require more than ~125k tokens of context. Complex tasks must be " +
      "broken into smaller pieces. Each task's description + AI instructions must be actionable " +
      "in a fresh session.",
    severity: "major",
    auditLogic:
      "Estimate token count from task description + AI instructions + referenced file sizes. " +
      "Check if filesInvolved count exceeds 10 files or total estimated tokens > 125k. " +
      "Flag tasks with excessive scope markers.",
    consequence:
      "Task is returned to planner for decomposition. Cannot be assigned to feature worker " +
      "until properly scoped.",
    appliesTo: "planner",
  },
  {
    lawCode: "LAW-013",
    title: "Feature Marked In Progress Before Worker Spawn",
    description:
      "Orchestrator must call dispatcher__manage_progress (action='start_work') on a feature " +
      "BEFORE spawning the feature-worker sub-agent. Ensures dashboard reflects started work " +
      "even if the worker fails.",
    severity: "major",
    auditLogic:
      "Compare feature start_work timestamp against sub-agent spawn timestamp in session events. " +
      "Verify feature transitions to 'In Progress' before any worker activity begins. " +
      "Check for features that went directly to Done without In Progress transition.",
    consequence:
      "Dashboard shows stale state during execution. Stakeholders cannot track real-time " +
      "progress. Orchestrator must ensure status updates precede worker invocations.",
    appliesTo: "orchestrator",
  },
  {
    lawCode: "LAW-014",
    title: "No Dishonest Completion of Unperformed Work",
    description:
      "Agents must never mark work as Done unless it was actually performed. Skipped, deferred, " +
      "or blocked tasks must remain in Backlog with the reason noted in AI notes.",
    severity: "critical",
    auditLogic:
      "For each completed task, verify corresponding git commits exist with the task identifier. " +
      "Check that code changes match the task's acceptance criteria. " +
      "Audit AI notes for skip/defer/block indicators on tasks marked Done.",
    consequence:
      "Task is reverted to Backlog. Agent is flagged for accountability review. " +
      "Repeated violations result in agent restriction.",
    appliesTo: "feature-worker",
  },
  {
    lawCode: "LAW-015",
    title: "Duplicate Check Before Epic Request Submission",
    description:
      "Request formulator must check for existing duplicate or similar epic requests before " +
      "submitting a new one. Must call dispatcher__list_epic_requests and compare against " +
      "pending/approved requests.",
    severity: "major",
    auditLogic:
      "Check session events for dispatcher__list_epic_requests call before epic request creation. " +
      "Verify the duplicate check occurred within the same session, prior to submission. " +
      "Flag requests submitted without prior list query.",
    consequence:
      "Duplicate requests clutter the backlog and waste reviewer time. " +
      "Request may be auto-rejected if duplicate is found post-submission.",
    appliesTo: "request-formulator",
  },
];

async function seedLaws(): Promise<void> {
  console.log("Seeding laws registry...");

  for (const law of laws) {
    const existing = await prisma.law.findUnique({
      where: { lawCode: law.lawCode },
    });

    if (existing) {
      console.log(`  Updating ${law.lawCode}: ${law.title}`);
      await prisma.law.update({
        where: { lawCode: law.lawCode },
        data: law,
      });
    } else {
      console.log(`  Creating ${law.lawCode}: ${law.title}`);
      await prisma.law.create({ data: law });
    }
  }

  console.log(`\nSeeded ${laws.length} laws successfully.`);
}

seedLaws()
  .catch((error) => {
    console.error("Failed to seed laws:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
