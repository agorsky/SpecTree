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
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "change_logs_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "change_logs_entity_type_entity_id_changed_at_idx" ON "change_logs"("entity_type", "entity_id", "changed_at" DESC);

-- CreateIndex
CREATE INDEX "change_logs_epic_id_changed_at_idx" ON "change_logs"("epic_id", "changed_at" DESC);

-- CreateIndex
CREATE INDEX "change_logs_changed_by_idx" ON "change_logs"("changed_by");
