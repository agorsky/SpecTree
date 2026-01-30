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
import { StatusSelect } from "@/components/common/status-select";
import { AssigneeSelect } from "@/components/common/assignee-select";
import { EpicSelect } from "@/components/common/epic-select";
import { useCreateFeature, useUpdateFeature } from "@/hooks/queries/use-features";
import { useAuthStore } from "@/stores/auth-store";
import type { Feature } from "@/lib/api/types";

interface FeatureFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature?: Feature | undefined;
  defaultEpicId?: string | undefined;
}

export function FeatureForm({
  open,
  onOpenChange,
  feature,
  defaultEpicId,
}: FeatureFormProps) {
  const isEditing = !!feature;
  const createFeature = useCreateFeature();
  const updateFeature = useUpdateFeature();
  const { user } = useAuthStore();

  const [title, setTitle] = useState(feature?.title ?? "");
  const [description, setDescription] = useState(feature?.description ?? "");
  const [epicId, setProjectId] = useState(feature?.epicId ?? defaultEpicId ?? "");
  const [statusId, setStatusId] = useState(feature?.statusId ?? "");
  const [assigneeId, setAssigneeId] = useState<string | undefined>(feature?.assigneeId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !epicId) return;

    try {
      if (isEditing) {
        const updateData: Parameters<typeof updateFeature.mutateAsync>[0] = {
          id: feature.id,
          title: title.trim(),
        };
        if (description.trim()) updateData.description = description.trim();
        if (statusId) updateData.statusId = statusId;
        if (assigneeId) updateData.assigneeId = assigneeId;
        await updateFeature.mutateAsync(updateData);
      } else {
        const createData: Parameters<typeof createFeature.mutateAsync>[0] = {
          title: title.trim(),
          epicId,
        };
        if (description.trim()) createData.description = description.trim();
        if (statusId) createData.statusId = statusId;
        if (assigneeId) createData.assigneeId = assigneeId;
        await createFeature.mutateAsync(createData);
      }
      onOpenChange(false);
      resetForm();
    } catch {
      // Error handling is done by the mutation
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setProjectId(defaultEpicId ?? "");
    setStatusId("");
    setAssigneeId(undefined);
  };

  const isPending = createFeature.isPending || updateFeature.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit Feature" : "New Feature"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Feature title"
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

            {!isEditing && (
              <div className="grid gap-2">
                <Label>Project</Label>
                <EpicSelect
                  value={epicId}
                  onChange={setProjectId}
                />
              </div>
            )}

            <div className="grid gap-2">
              <Label>Status</Label>
              <StatusSelect
                teamId={user?.teamId}
                value={statusId}
                onChange={(id) => id && setStatusId(id)}
                placeholder="Select status"
              />
            </div>

            <div className="grid gap-2">
              <Label>Assignee</Label>
              <AssigneeSelect
                value={assigneeId}
                onChange={setAssigneeId}
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
            <Button type="submit" disabled={isPending || !title.trim() || !epicId}>
              {isPending ? "Saving..." : isEditing ? "Save Changes" : "Create Feature"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
