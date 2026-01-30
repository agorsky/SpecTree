-- Rename projects table to epics
ALTER TABLE "projects" RENAME TO "epics";

-- Rename the foreign key column in features table
ALTER TABLE "features" RENAME COLUMN "project_id" TO "epic_id";
