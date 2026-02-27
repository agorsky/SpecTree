-- CreateTable
CREATE TABLE "cases" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "case_number" INTEGER NOT NULL,
    "accused_agent" TEXT NOT NULL,
    "law_id" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "filed_by" TEXT NOT NULL DEFAULT 'barney',
    "verdict" TEXT,
    "verdict_reason" TEXT,
    "deduction_level" TEXT,
    "remediation_task_id" TEXT,
    "filed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "cases_law_id_fkey" FOREIGN KEY ("law_id") REFERENCES "laws" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cases_remediation_task_id_fkey" FOREIGN KEY ("remediation_task_id") REFERENCES "tasks" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "cases_case_number_key" ON "cases"("case_number");

-- CreateIndex
CREATE UNIQUE INDEX "cases_remediation_task_id_key" ON "cases"("remediation_task_id");

-- CreateIndex
CREATE INDEX "cases_status_idx" ON "cases"("status");

-- CreateIndex
CREATE INDEX "cases_accused_agent_idx" ON "cases"("accused_agent");

-- CreateIndex
CREATE INDEX "cases_law_id_idx" ON "cases"("law_id");

-- CreateIndex
CREATE INDEX "cases_severity_idx" ON "cases"("severity");

-- CreateIndex
CREATE INDEX "cases_filed_at_idx" ON "cases"("filed_at");
