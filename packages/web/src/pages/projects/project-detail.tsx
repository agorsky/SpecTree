import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useProject, useUpdateProject, useDeleteProject } from "@/hooks/queries/use-projects";
import { IssuesList } from "@/components/issues/issues-list";
import { FeatureForm } from "@/components/features/feature-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, Trash2, Check, X, Settings } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { data: project, isLoading } = useProject(projectId ?? "");
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();

  const [isFeatureFormOpen, setIsFeatureFormOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-6 w-full animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Project not found</p>
        <Button variant="ghost" onClick={() => navigate("/projects")} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to projects
        </Button>
      </div>
    );
  }

  const handleNameSave = async () => {
    if (editedName.trim() && editedName !== project.name) {
      await updateProject.mutateAsync({
        id: project.id,
        name: editedName.trim(),
      });
    }
    setIsEditingName(false);
  };

  const handleDelete = async () => {
    await deleteProject.mutateAsync(project.id);
    navigate("/projects");
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b">
        <Button variant="ghost" size="icon" onClick={() => navigate("/projects")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <Input
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="text-xl font-semibold"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleNameSave();
                  if (e.key === "Escape") setIsEditingName(false);
                }}
              />
              <Button size="icon" variant="ghost" onClick={handleNameSave}>
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setIsEditingName(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <h1
              className="text-xl font-semibold cursor-pointer hover:bg-muted/50 px-2 py-1 rounded -mx-2"
              onClick={() => {
                setEditedName(project.name);
                setIsEditingName(true);
              }}
            >
              {project.name}
            </h1>
          )}
          {project.description && (
            <p className="text-sm text-muted-foreground mt-1">
              {project.description}
            </p>
          )}
        </div>
        <Button onClick={() => setIsFeatureFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Feature
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete project
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Issues (Features + Tasks) */}
      <div className="flex-1 overflow-auto">
        {projectId && <IssuesList projectId={projectId} />}
      </div>

      {/* Feature form */}
      {projectId && (
        <FeatureForm
          open={isFeatureFormOpen}
          onOpenChange={setIsFeatureFormOpen}
          defaultProjectId={projectId}
        />
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{project.name}"? This will also
              delete all features in this project. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteProject.isPending}
            >
              {deleteProject.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
