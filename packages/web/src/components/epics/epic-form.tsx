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
import { useCreateEpic, useUpdateEpic } from "@/hooks/queries/use-epics";
import { useAuthStore } from "@/stores/auth-store";
import type { Epic } from "@/lib/api/types";

interface EpicFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  epic?: Epic;
}

export function EpicForm({ open, onOpenChange, epic }: EpicFormProps) {
  const isEditing = !!epic;
  const createEpic = useCreateEpic();
  const updateEpic = useUpdateEpic();
  const { user } = useAuthStore();

  const [name, setName] = useState(epic?.name ?? "");
  const [description, setDescription] = useState(epic?.description ?? "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) return;

    try {
      if (isEditing) {
        const updateData: Parameters<typeof updateEpic.mutateAsync>[0] = {
          id: epic.id,
          name: name.trim(),
        };
        if (description.trim()) updateData.description = description.trim();
        await updateEpic.mutateAsync(updateData);
      } else {
        // Use the user's teamId for new epics
        // This assumes the user has a teamId - in a real app you might need team selection
        const teamId = user?.teamId;
        if (!teamId) {
          console.error("No team ID available");
          return;
        }
        const createData: Parameters<typeof createEpic.mutateAsync>[0] = {
          name: name.trim(),
          teamId,
        };
        if (description.trim()) createData.description = description.trim();
        await createEpic.mutateAsync(createData);
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

  const isPending = createEpic.isPending || updateEpic.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit Epic" : "New Epic"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Epic name"
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
              {isPending ? "Saving..." : isEditing ? "Save Changes" : "Create Epic"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
