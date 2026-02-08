-- Drop the change_logs table and recreate without foreign key constraint
-- SQLite does not support ALTER TABLE DROP CONSTRAINT, so we must recreate
-- The table is new and only contains failed FK-violating entries, so no data loss

DROP TABLE IF EXISTS "change_logs";

-- CreateTable (without foreign key on changed_by)
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

-- CreateIndex
CREATE INDEX "change_logs_entity_type_entity_id_changed_at_idx" ON "change_logs"("entity_type", "entity_id", "changed_at" DESC);

-- CreateIndex
CREATE INDEX "change_logs_epic_id_changed_at_idx" ON "change_logs"("epic_id", "changed_at" DESC);

-- CreateIndex
CREATE INDEX "change_logs_changed_by_idx" ON "change_logs"("changed_by");
