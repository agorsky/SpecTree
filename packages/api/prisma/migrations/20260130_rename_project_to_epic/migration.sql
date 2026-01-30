-- Rename projects table to epics
ALTER TABLE "projects" RENAME TO "epics";

-- Rename project_id column to epic_id in features table
ALTER TABLE "features" RENAME COLUMN "project_id" TO "epic_id";
