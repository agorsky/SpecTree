-- RedefineIndex
DROP INDEX "projects_team_id_sort_order_idx";
CREATE INDEX "epics_team_id_sort_order_idx" ON "epics"("team_id", "sort_order");

-- RedefineIndex
DROP INDEX "projects_team_id_idx";
CREATE INDEX "epics_team_id_idx" ON "epics"("team_id");

-- RedefineIndex
DROP INDEX "features_project_id_status_id_idx";
CREATE INDEX "features_epic_id_status_id_idx" ON "features"("epic_id", "status_id");

-- RedefineIndex
DROP INDEX "features_project_id_sort_order_idx";
CREATE INDEX "features_epic_id_sort_order_idx" ON "features"("epic_id", "sort_order");

-- RedefineIndex
DROP INDEX "features_project_id_idx";
CREATE INDEX "features_epic_id_idx" ON "features"("epic_id");
