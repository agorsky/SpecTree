-- CreateTable
CREATE TABLE "health_checks" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "users" (
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
CREATE TABLE "api_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "scopes" TEXT,
    "expires_at" DATETIME,
    "last_used_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "api_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "memberships_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "epics" (
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

-- CreateTable
CREATE TABLE "statuses" (
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

-- CreateTable
CREATE TABLE "features" (
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

-- CreateTable
CREATE TABLE "tasks" (
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
CREATE TABLE "session_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "epic_id" TEXT NOT NULL,
    "session_id" TEXT,
    "event_type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "session_events_epic_id_fkey" FOREIGN KEY ("epic_id") REFERENCES "epics" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "session_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "ai_sessions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
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
CREATE TABLE "change_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "changed_by" TEXT NOT NULL,
    "changed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "epic_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
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

-- CreateTable
CREATE TABLE "skill_packs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT,
    "author_name" TEXT,
    "author_url" TEXT,
    "homepage_url" TEXT,
    "latest_version" TEXT,
    "is_official" BOOLEAN NOT NULL DEFAULT false,
    "is_deprecated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "skill_pack_versions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "skill_pack_id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "manifest" TEXT NOT NULL,
    "release_notes" TEXT,
    "is_prerelease" BOOLEAN NOT NULL DEFAULT false,
    "published_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "skill_pack_versions_skill_pack_id_fkey" FOREIGN KEY ("skill_pack_id") REFERENCES "skill_packs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "installed_skill_packs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "skill_pack_id" TEXT NOT NULL,
    "installed_version" TEXT NOT NULL,
    "installed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "installed_skill_packs_skill_pack_id_fkey" FOREIGN KEY ("skill_pack_id") REFERENCES "skill_packs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "teams_key_key" ON "teams"("key");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_invitations_email_key" ON "user_invitations"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_invitations_code_key" ON "user_invitations"("code");

-- CreateIndex
CREATE UNIQUE INDEX "api_tokens_token_hash_key" ON "api_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "api_tokens_user_id_idx" ON "api_tokens"("user_id");

-- CreateIndex
CREATE INDEX "api_tokens_token_hash_idx" ON "api_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "memberships_user_id_idx" ON "memberships"("user_id");

-- CreateIndex
CREATE INDEX "memberships_team_id_idx" ON "memberships"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_user_id_team_id_key" ON "memberships"("user_id", "team_id");

-- CreateIndex
CREATE INDEX "epics_team_id_idx" ON "epics"("team_id");

-- CreateIndex
CREATE INDEX "epics_team_id_sort_order_idx" ON "epics"("team_id", "sort_order");

-- CreateIndex
CREATE INDEX "epics_personal_scope_id_idx" ON "epics"("personal_scope_id");

-- CreateIndex
CREATE INDEX "epics_created_by_idx" ON "epics"("created_by");

-- CreateIndex
CREATE INDEX "epics_implemented_by_idx" ON "epics"("implemented_by");

-- CreateIndex
CREATE INDEX "statuses_team_id_idx" ON "statuses"("team_id");

-- CreateIndex
CREATE INDEX "statuses_team_id_position_idx" ON "statuses"("team_id", "position");

-- CreateIndex
CREATE INDEX "statuses_personal_scope_id_idx" ON "statuses"("personal_scope_id");

-- CreateIndex
CREATE UNIQUE INDEX "statuses_team_id_name_key" ON "statuses"("team_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "statuses_personal_scope_id_name_key" ON "statuses"("personal_scope_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "features_identifier_key" ON "features"("identifier");

-- CreateIndex
CREATE INDEX "features_epic_id_idx" ON "features"("epic_id");

-- CreateIndex
CREATE INDEX "features_status_id_idx" ON "features"("status_id");

-- CreateIndex
CREATE INDEX "features_assignee_id_idx" ON "features"("assignee_id");

-- CreateIndex
CREATE INDEX "features_epic_id_sort_order_idx" ON "features"("epic_id", "sort_order");

-- CreateIndex
CREATE INDEX "features_epic_id_status_id_idx" ON "features"("epic_id", "status_id");

-- CreateIndex
CREATE INDEX "features_assignee_id_status_id_idx" ON "features"("assignee_id", "status_id");

-- CreateIndex
CREATE INDEX "features_created_by_idx" ON "features"("created_by");

-- CreateIndex
CREATE INDEX "features_implemented_by_idx" ON "features"("implemented_by");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_identifier_key" ON "tasks"("identifier");

-- CreateIndex
CREATE INDEX "tasks_feature_id_idx" ON "tasks"("feature_id");

-- CreateIndex
CREATE INDEX "tasks_status_id_idx" ON "tasks"("status_id");

-- CreateIndex
CREATE INDEX "tasks_assignee_id_idx" ON "tasks"("assignee_id");

-- CreateIndex
CREATE INDEX "tasks_feature_id_sort_order_idx" ON "tasks"("feature_id", "sort_order");

-- CreateIndex
CREATE INDEX "tasks_assignee_id_status_id_idx" ON "tasks"("assignee_id", "status_id");

-- CreateIndex
CREATE INDEX "tasks_created_by_idx" ON "tasks"("created_by");

-- CreateIndex
CREATE INDEX "tasks_implemented_by_idx" ON "tasks"("implemented_by");

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
CREATE INDEX "session_events_epic_id_timestamp_idx" ON "session_events"("epic_id", "timestamp");

-- CreateIndex
CREATE INDEX "session_events_epic_id_session_id_idx" ON "session_events"("epic_id", "session_id");

-- CreateIndex
CREATE INDEX "session_events_event_type_idx" ON "session_events"("event_type");

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
CREATE INDEX "change_logs_entity_type_entity_id_changed_at_idx" ON "change_logs"("entity_type", "entity_id", "changed_at" DESC);

-- CreateIndex
CREATE INDEX "change_logs_epic_id_changed_at_idx" ON "change_logs"("epic_id", "changed_at" DESC);

-- CreateIndex
CREATE INDEX "change_logs_changed_by_idx" ON "change_logs"("changed_by");

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

-- CreateIndex
CREATE UNIQUE INDEX "skill_packs_name_key" ON "skill_packs"("name");

-- CreateIndex
CREATE INDEX "skill_packs_name_idx" ON "skill_packs"("name");

-- CreateIndex
CREATE INDEX "skill_packs_is_official_idx" ON "skill_packs"("is_official");

-- CreateIndex
CREATE INDEX "skill_pack_versions_skill_pack_id_idx" ON "skill_pack_versions"("skill_pack_id");

-- CreateIndex
CREATE INDEX "skill_pack_versions_skill_pack_id_published_at_idx" ON "skill_pack_versions"("skill_pack_id", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "skill_pack_versions_skill_pack_id_version_key" ON "skill_pack_versions"("skill_pack_id", "version");

-- CreateIndex
CREATE INDEX "installed_skill_packs_skill_pack_id_idx" ON "installed_skill_packs"("skill_pack_id");

-- CreateIndex
CREATE INDEX "installed_skill_packs_is_enabled_idx" ON "installed_skill_packs"("is_enabled");

-- CreateIndex
CREATE UNIQUE INDEX "installed_skill_packs_skill_pack_id_key" ON "installed_skill_packs"("skill_pack_id");

