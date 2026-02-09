import { useState, useEffect } from "react";
import { useCreateTeamStatus, useUpdateTeamStatus } from "@/hooks/queries/use-teams";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Status } from "@/lib/api/types";

interface StatusFormProps {
  teamId: string;
  status?: Status | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PREDEFINED_COLORS = [
  "#94a3b8", // slate
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
] as const;

const DEFAULT_COLOR = "#94a3b8";

const CATEGORY_OPTIONS = [
  { value: "backlog", label: "Backlog" },
  { value: "unstarted", label: "Unstarted" },
  { value: "started", label: "Started" },
  { value: "completed", label: "Completed" },
  { value: "canceled", label: "Canceled" },
] as const;

export function StatusForm({ teamId, status, open, onOpenChange }: StatusFormProps) {
  const createStatus = useCreateTeamStatus();
  const updateStatus = useUpdateTeamStatus();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Status["category"]>("unstarted");
  const [color, setColor] = useState<string>(DEFAULT_COLOR);
  const [error, setError] = useState("");

  const isEditing = !!status;

  useEffect(() => {
    if (open) {
      setName(status?.name ?? "");
      setCategory(status?.category ?? "unstarted");
      setColor(status?.color || DEFAULT_COLOR);
      setError("");
    }
  }, [status, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    try {
      if (isEditing) {
        const updateData: { teamId: string; statusId: string; name?: string; category?: Status["category"]; color?: string } = {
          teamId,
          statusId: status.id,
        };
        if (name.trim() !== status.name) updateData.name = name.trim();
        if (category !== status.category) updateData.category = category;
        const statusColor = status.color || DEFAULT_COLOR;
        if (color !== statusColor) updateData.color = color;
        
        await updateStatus.mutateAsync(updateData);
      } else {
        await createStatus.mutateAsync({
          teamId,
          name: name.trim(),
          category,
          color,
        });
        // Clear form after successful creation
        setName("");
        setCategory("unstarted");
        setColor(DEFAULT_COLOR);
      }
      onOpenChange(false);
    } catch (err: unknown) {
      if (err && typeof err === "object" && "data" in err) {
        const data = (err as { data: { message?: string } }).data;
        setError(data?.message || "Failed to save status");
      } else {
        setError("Failed to save status");
      }
    }
  };

  const isPending = createStatus.isPending || updateStatus.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={(e) => void handleSubmit(e)}>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Status" : "Create Status"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error && <div className="text-sm text-destructive">{error}</div>}
            
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="In Progress"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={category}
                onValueChange={(value) => setCategory(value as Status["category"])}
              >
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Color</Label>
              <div className="flex gap-2 flex-wrap">
                {PREDEFINED_COLORS.map((predefinedColor) => (
                  <button
                    key={predefinedColor}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      color === predefinedColor
                        ? "border-primary scale-110"
                        : "border-transparent hover:scale-105"
                    }`}
                    style={{ backgroundColor: predefinedColor }}
                    onClick={() => setColor(predefinedColor)}
                  />
                ))}
              </div>
              <div className="flex gap-2 items-center mt-2">
                <Input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="#3b82f6"
                  maxLength={7}
                  pattern="^#[0-9A-Fa-f]{6}$"
                />
                <div
                  className="w-8 h-8 rounded border flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
              </div>
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
              {isPending ? "Saving..." : isEditing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
