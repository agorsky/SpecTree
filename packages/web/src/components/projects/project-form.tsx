import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateProject, useUpdateProject } from "@/hooks/queries/use-projects";
import { useAuthStore } from "@/stores/auth-store";
import type { Project } from "@/lib/api/types";

interface ProjectFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: Project;
}

export function ProjectForm({ open, onOpenChange, project }: ProjectFormProps) {
  const isEditing = !!project;
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const { user } = useAuthStore();

  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) return;

    try {
      if (isEditing) {
        const updateData: Parameters<typeof updateProject.mutateAsync>[0] = {
          id: project.id,
          name: name.trim(),
        };
        if (description.trim()) updateData.description = description.trim();
        await updateProject.mutateAsync(updateData);
      } else {
        // Use the user's teamId for new projects
        // This assumes the user has a teamId - in a real app you might need team selection
        const teamId = user?.teamId;
        if (!teamId) {
          console.error("No team ID available");
          return;
        }
        const createData: Parameters<typeof createProject.mutateAsync>[0] = {
          name: name.trim(),
          teamId,
        };
        if (description.trim()) createData.description = description.trim();
        await createProject.mutateAsync(createData);
      }
      onOpenChange(false);
      resetForm();
    } catch {
      // Error handling is done by the mutation
    }
  };

  const resetForm = () => {
    setName("");
    setDescription("");
  };

  const isPending = createProject.isPending || updateProject.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit Project" : "New Project"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Project name"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !name.trim()}>
              {isPending ? "Saving..." : isEditing ? "Save Changes" : "Create Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
