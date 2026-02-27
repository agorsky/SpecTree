-- CreateTable
CREATE TABLE "agent_scores" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agent_name" TEXT NOT NULL,
    "agent_title" TEXT NOT NULL,
    "total_score" INTEGER NOT NULL DEFAULT 100,
    "busts_received" INTEGER NOT NULL DEFAULT 0,
    "busts_issued" INTEGER NOT NULL DEFAULT 0,
    "clean_cycles" INTEGER NOT NULL DEFAULT 0,
    "last_audit_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_scores_agent_name_key" ON "agent_scores"("agent_name");
