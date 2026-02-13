-- CreateTable
CREATE TABLE "user_invitations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "used_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_invitations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "personal_scopes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "personal_scopes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "plan_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_built_in" BOOLEAN NOT NULL DEFAULT false,
    "structure" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "created_by_id" TEXT,
    CONSTRAINT "plan_templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ai_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "epic_id" TEXT NOT NULL,
    "external_id" TEXT,
    "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'active',
    "items_worked_on" TEXT,
    "summary" TEXT,
    "next_steps" TEXT,
    "blockers" TEXT,
    "decisions" TEXT,
    "context_blob" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "ai_sessions_epic_id_fkey" FOREIGN KEY ("epic_id") REFERENCES "epics" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "decisions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "epic_id" TEXT NOT NULL,
    "feature_id" TEXT,
    "task_id" TEXT,
    "question" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "alternatives" TEXT,
    "made_by" TEXT NOT NULL,
    "made_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" TEXT,
    "impact" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "decisions_epic_id_fkey" FOREIGN KEY ("epic_id") REFERENCES "epics" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "decisions_feature_id_fkey" FOREIGN KEY ("feature_id") REFERENCES "features" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "decisions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "epic_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "structured_desc" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requested_by_id" TEXT NOT NULL,
    "converted_epic_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "epic_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "epic_requests_converted_epic_id_fkey" FOREIGN KEY ("converted_epic_id") REFERENCES "epics" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "epic_request_reactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "epic_request_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reaction_type" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "epic_request_reactions_epic_request_id_fkey" FOREIGN KEY ("epic_request_id") REFERENCES "epic_requests" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "epic_request_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "epic_request_comments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "epic_request_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "epic_request_comments_epic_request_id_fkey" FOREIGN KEY ("epic_request_id") REFERENCES "epic_requests" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "epic_request_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_epics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "sort_order" REAL NOT NULL DEFAULT 0,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "scope_type" TEXT NOT NULL DEFAULT 'team',
    "team_id" TEXT,
    "personal_scope_id" TEXT,
    "created_by" TEXT,
    "implemented_by" TEXT,
    "implemented_date" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "structured_desc" TEXT,
    "ai_context" TEXT,
    "ai_notes" TEXT,
    "last_ai_session_id" TEXT,
    "last_ai_update_at" DATETIME,
    CONSTRAINT "epics_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "epics_personal_scope_id_fkey" FOREIGN KEY ("personal_scope_id") REFERENCES "personal_scopes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "epics_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "epics_implemented_by_fkey" FOREIGN KEY ("implemented_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_epics" ("color", "created_at", "description", "icon", "id", "is_archived", "name", "sort_order", "team_id", "updated_at") SELECT "color", "created_at", "description", "icon", "id", "is_archived", "name", "sort_order", "team_id", "updated_at" FROM "epics";
DROP TABLE "epics";
ALTER TABLE "new_epics" RENAME TO "epics";
CREATE INDEX "epics_team_id_idx" ON "epics"("team_id");
CREATE INDEX "epics_team_id_sort_order_idx" ON "epics"("team_id", "sort_order");
CREATE INDEX "epics_personal_scope_id_idx" ON "epics"("personal_scope_id");
CREATE INDEX "epics_created_by_idx" ON "epics"("created_by");
CREATE INDEX "epics_implemented_by_idx" ON "epics"("implemented_by");
CREATE TABLE "new_features" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "epic_id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status_id" TEXT,
    "assignee_id" TEXT,
    "sort_order" REAL NOT NULL DEFAULT 0,
    "created_by" TEXT,
    "implemented_by" TEXT,
    "implemented_date" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "execution_order" INTEGER,
    "can_parallelize" BOOLEAN NOT NULL DEFAULT false,
    "parallel_group" TEXT,
    "dependencies" TEXT,
    "estimated_complexity" TEXT,
    "ai_context" TEXT,
    "ai_notes" TEXT,
    "last_ai_session_id" TEXT,
    "last_ai_update_at" DATETIME,
    "started_at" DATETIME,
    "completed_at" DATETIME,
    "duration_minutes" INTEGER,
    "percent_complete" INTEGER,
    "blocker_reason" TEXT,
    "structured_desc" TEXT,
    "related_files" TEXT,
    "related_functions" TEXT,
    "git_branch" TEXT,
    "git_commits" TEXT,
    "git_pr_number" INTEGER,
    "git_pr_url" TEXT,
    CONSTRAINT "features_epic_id_fkey" FOREIGN KEY ("epic_id") REFERENCES "epics" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "features_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "statuses" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "features_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "features_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "features_implemented_by_fkey" FOREIGN KEY ("implemented_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_features" ("assignee_id", "created_at", "description", "epic_id", "id", "identifier", "sort_order", "status_id", "title", "updated_at") SELECT "assignee_id", "created_at", "description", "epic_id", "id", "identifier", "sort_order", "status_id", "title", "updated_at" FROM "features";
DROP TABLE "features";
ALTER TABLE "new_features" RENAME TO "features";
CREATE UNIQUE INDEX "features_identifier_key" ON "features"("identifier");
CREATE INDEX "features_epic_id_idx" ON "features"("epic_id");
CREATE INDEX "features_status_id_idx" ON "features"("status_id");
CREATE INDEX "features_assignee_id_idx" ON "features"("assignee_id");
CREATE INDEX "features_epic_id_sort_order_idx" ON "features"("epic_id", "sort_order");
CREATE INDEX "features_epic_id_status_id_idx" ON "features"("epic_id", "status_id");
CREATE INDEX "features_assignee_id_status_id_idx" ON "features"("assignee_id", "status_id");
CREATE INDEX "features_created_by_idx" ON "features"("created_by");
CREATE INDEX "features_implemented_by_idx" ON "features"("implemented_by");
CREATE TABLE "new_statuses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "team_id" TEXT,
    "personal_scope_id" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "color" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "statuses_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "statuses_personal_scope_id_fkey" FOREIGN KEY ("personal_scope_id") REFERENCES "personal_scopes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_statuses" ("category", "color", "created_at", "id", "name", "position", "team_id", "updated_at") SELECT "category", "color", "created_at", "id", "name", "position", "team_id", "updated_at" FROM "statuses";
DROP TABLE "statuses";
ALTER TABLE "new_statuses" RENAME TO "statuses";
CREATE INDEX "statuses_team_id_idx" ON "statuses"("team_id");
CREATE INDEX "statuses_team_id_position_idx" ON "statuses"("team_id", "position");
CREATE INDEX "statuses_personal_scope_id_idx" ON "statuses"("personal_scope_id");
CREATE UNIQUE INDEX "statuses_team_id_name_key" ON "statuses"("team_id", "name");
CREATE TABLE "new_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "feature_id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status_id" TEXT,
    "assignee_id" TEXT,
    "sort_order" REAL NOT NULL DEFAULT 0,
    "created_by" TEXT,
    "implemented_by" TEXT,
    "implemented_date" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "execution_order" INTEGER,
    "can_parallelize" BOOLEAN NOT NULL DEFAULT false,
    "parallel_group" TEXT,
    "dependencies" TEXT,
    "estimated_complexity" TEXT,
    "ai_context" TEXT,
    "ai_notes" TEXT,
    "last_ai_session_id" TEXT,
    "last_ai_update_at" DATETIME,
    "started_at" DATETIME,
    "completed_at" DATETIME,
    "duration_minutes" INTEGER,
    "percent_complete" INTEGER,
    "blocker_reason" TEXT,
    "structured_desc" TEXT,
    "related_files" TEXT,
    "related_functions" TEXT,
    "git_branch" TEXT,
    "git_commits" TEXT,
    "git_pr_number" INTEGER,
    "git_pr_url" TEXT,
    "validation_checks" TEXT,
    CONSTRAINT "tasks_feature_id_fkey" FOREIGN KEY ("feature_id") REFERENCES "features" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tasks_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "statuses" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "tasks_implemented_by_fkey" FOREIGN KEY ("implemented_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_tasks" ("assignee_id", "created_at", "description", "feature_id", "id", "identifier", "sort_order", "status_id", "title", "updated_at") SELECT "assignee_id", "created_at", "description", "feature_id", "id", "identifier", "sort_order", "status_id", "title", "updated_at" FROM "tasks";
DROP TABLE "tasks";
ALTER TABLE "new_tasks" RENAME TO "tasks";
CREATE UNIQUE INDEX "tasks_identifier_key" ON "tasks"("identifier");
CREATE INDEX "tasks_feature_id_idx" ON "tasks"("feature_id");
CREATE INDEX "tasks_status_id_idx" ON "tasks"("status_id");
CREATE INDEX "tasks_assignee_id_idx" ON "tasks"("assignee_id");
CREATE INDEX "tasks_feature_id_sort_order_idx" ON "tasks"("feature_id", "sort_order");
CREATE INDEX "tasks_assignee_id_status_id_idx" ON "tasks"("assignee_id", "status_id");
CREATE INDEX "tasks_created_by_idx" ON "tasks"("created_by");
CREATE INDEX "tasks_implemented_by_idx" ON "tasks"("implemented_by");
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "avatar_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_global_admin" BOOLEAN NOT NULL DEFAULT false,
    "time_zone" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_users" ("avatar_url", "created_at", "email", "id", "is_active", "name", "password_hash", "updated_at") SELECT "avatar_url", "created_at", "email", "id", "is_active", "name", "password_hash", "updated_at" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_email_idx" ON "users"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "user_invitations_email_key" ON "user_invitations"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_invitations_code_key" ON "user_invitations"("code");

-- CreateIndex
CREATE UNIQUE INDEX "personal_scopes_user_id_key" ON "personal_scopes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "plan_templates_name_key" ON "plan_templates"("name");

-- CreateIndex
CREATE INDEX "plan_templates_name_idx" ON "plan_templates"("name");

-- CreateIndex
CREATE INDEX "plan_templates_is_built_in_idx" ON "plan_templates"("is_built_in");

-- CreateIndex
CREATE INDEX "ai_sessions_epic_id_idx" ON "ai_sessions"("epic_id");

-- CreateIndex
CREATE INDEX "ai_sessions_epic_id_status_idx" ON "ai_sessions"("epic_id", "status");

-- CreateIndex
CREATE INDEX "ai_sessions_started_at_idx" ON "ai_sessions"("started_at");

-- CreateIndex
CREATE INDEX "decisions_epic_id_idx" ON "decisions"("epic_id");

-- CreateIndex
CREATE INDEX "decisions_epic_id_made_at_idx" ON "decisions"("epic_id", "made_at");

-- CreateIndex
CREATE INDEX "decisions_feature_id_idx" ON "decisions"("feature_id");

-- CreateIndex
CREATE INDEX "decisions_task_id_idx" ON "decisions"("task_id");

-- CreateIndex
CREATE INDEX "decisions_category_idx" ON "decisions"("category");

-- CreateIndex
CREATE UNIQUE INDEX "epic_requests_converted_epic_id_key" ON "epic_requests"("converted_epic_id");

-- CreateIndex
CREATE INDEX "epic_requests_requested_by_id_idx" ON "epic_requests"("requested_by_id");

-- CreateIndex
CREATE INDEX "epic_requests_converted_epic_id_idx" ON "epic_requests"("converted_epic_id");

-- CreateIndex
CREATE INDEX "epic_requests_status_idx" ON "epic_requests"("status");

-- CreateIndex
CREATE INDEX "epic_requests_created_at_idx" ON "epic_requests"("created_at");

-- CreateIndex
CREATE INDEX "epic_request_reactions_epic_request_id_idx" ON "epic_request_reactions"("epic_request_id");

-- CreateIndex
CREATE INDEX "epic_request_reactions_user_id_idx" ON "epic_request_reactions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "epic_request_reactions_epic_request_id_user_id_key" ON "epic_request_reactions"("epic_request_id", "user_id");

-- CreateIndex
CREATE INDEX "epic_request_comments_epic_request_id_idx" ON "epic_request_comments"("epic_request_id");

-- CreateIndex
CREATE INDEX "epic_request_comments_author_id_idx" ON "epic_request_comments"("author_id");

-- CreateIndex
CREATE INDEX "epic_request_comments_epic_request_id_created_at_idx" ON "epic_request_comments"("epic_request_id", "created_at");
