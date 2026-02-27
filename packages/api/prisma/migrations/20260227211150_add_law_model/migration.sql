-- AlterTable
ALTER TABLE "ai_sessions" ADD COLUMN "state_machine_state" TEXT;

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
CREATE TABLE "laws" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "law_code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "audit_logic" TEXT NOT NULL,
    "consequence" TEXT NOT NULL,
    "applies_to" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
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
CREATE TABLE "skill_pack_files" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "version_id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mime_type" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "skill_pack_files_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "skill_pack_versions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_epic_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "structured_desc" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requested_by_id" TEXT NOT NULL,
    "converted_epic_id" TEXT,
    "personal_scope_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "epic_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "epic_requests_converted_epic_id_fkey" FOREIGN KEY ("converted_epic_id") REFERENCES "epics" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "epic_requests_personal_scope_id_fkey" FOREIGN KEY ("personal_scope_id") REFERENCES "personal_scopes" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_epic_requests" ("converted_epic_id", "created_at", "description", "id", "requested_by_id", "status", "structured_desc", "title", "updated_at") SELECT "converted_epic_id", "created_at", "description", "id", "requested_by_id", "status", "structured_desc", "title", "updated_at" FROM "epic_requests";
DROP TABLE "epic_requests";
ALTER TABLE "new_epic_requests" RENAME TO "epic_requests";
CREATE UNIQUE INDEX "epic_requests_converted_epic_id_key" ON "epic_requests"("converted_epic_id");
CREATE INDEX "epic_requests_requested_by_id_idx" ON "epic_requests"("requested_by_id");
CREATE INDEX "epic_requests_converted_epic_id_idx" ON "epic_requests"("converted_epic_id");
CREATE INDEX "epic_requests_personal_scope_id_idx" ON "epic_requests"("personal_scope_id");
CREATE INDEX "epic_requests_status_idx" ON "epic_requests"("status");
CREATE INDEX "epic_requests_created_at_idx" ON "epic_requests"("created_at");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "session_events_epic_id_timestamp_idx" ON "session_events"("epic_id", "timestamp");

-- CreateIndex
CREATE INDEX "session_events_epic_id_session_id_idx" ON "session_events"("epic_id", "session_id");

-- CreateIndex
CREATE INDEX "session_events_event_type_idx" ON "session_events"("event_type");

-- CreateIndex
CREATE UNIQUE INDEX "laws_law_code_key" ON "laws"("law_code");

-- CreateIndex
CREATE INDEX "laws_severity_idx" ON "laws"("severity");

-- CreateIndex
CREATE INDEX "laws_applies_to_idx" ON "laws"("applies_to");

-- CreateIndex
CREATE INDEX "laws_is_active_idx" ON "laws"("is_active");

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
CREATE INDEX "skill_pack_files_version_id_idx" ON "skill_pack_files"("version_id");

-- CreateIndex
CREATE UNIQUE INDEX "skill_pack_files_version_id_path_key" ON "skill_pack_files"("version_id", "path");

-- CreateIndex
CREATE INDEX "installed_skill_packs_skill_pack_id_idx" ON "installed_skill_packs"("skill_pack_id");

-- CreateIndex
CREATE INDEX "installed_skill_packs_is_enabled_idx" ON "installed_skill_packs"("is_enabled");

-- CreateIndex
CREATE UNIQUE INDEX "installed_skill_packs_skill_pack_id_key" ON "installed_skill_packs"("skill_pack_id");

-- CreateIndex
CREATE UNIQUE INDEX "statuses_personal_scope_id_name_key" ON "statuses"("personal_scope_id", "name");
