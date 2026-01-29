import { useState, useEffect } from "react";
import { useCreateTeam, useUpdateTeam } from "@/hooks/queries/use-teams";
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
import type { Team } from "@/lib/api/types";

interface TeamFormProps {
  team?: Team;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TeamForm({ team, open, onOpenChange }: TeamFormProps) {
  const createTeam = useCreateTeam();
  const updateTeam = useUpdateTeam();
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [keyManuallyEdited, setKeyManuallyEdited] = useState(false);
  const [error, setError] = useState("");

  const isEditing = !!team;

  useEffect(() => {
    if (open) {
      setName(team?.name ?? "");
      setKey(team?.key ?? "");
      setKeyManuallyEdited(!!team);
      setError("");
    }
  }, [team, open]);

  // Auto-generate key from name (first 3 letters, uppercase)
  const handleNameChange = (value: string) => {
    setName(value);
    if (!isEditing && !keyManuallyEdited) {
      const autoKey = value
        .replace(/[^a-zA-Z]/g, "")
        .substring(0, 3)
        .toUpperCase();
      setKey(autoKey);
    }
  };

  const handleKeyChange = (value: string) => {
    setKey(value.toUpperCase());
    setKeyManuallyEdited(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) return;
    if (!isEditing && !key.trim()) {
      setError("Key is required");
      return;
    }

    try {
      if (isEditing) {
        await updateTeam.mutateAsync({ id: team.id, name: name.trim() });
      } else {
        await createTeam.mutateAsync({ name: name.trim(), key: key.trim().toUpperCase() });
      }
      onOpenChange(false);
    } catch (err: unknown) {
      if (err && typeof err === "object" && "data" in err) {
        const data = (err as { data: { message?: string } }).data;
        setError(data?.message || "Failed to save team");
      } else {
        setError("Failed to save team");
      }
    }
  };

  const isPending = createTeam.isPending || updateTeam.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={(e) => void handleSubmit(e)}>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Team" : "Create Team"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error && <div className="text-sm text-destructive">{error}</div>}
            <div className="grid gap-2">
              <Label htmlFor="name">Team Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => { handleNameChange(e.target.value); }}
                placeholder="Engineering"
                required
              />
            </div>
            {!isEditing && (
              <div className="grid gap-2">
                <Label htmlFor="key">Team Key</Label>
                <Input
                  id="key"
                  value={key}
                  onChange={(e) => { handleKeyChange(e.target.value.replace(/[^A-Za-z]/g, "")); }}
                  placeholder="ENG"
                  maxLength={10}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Short identifier (uppercase letters only, e.g., ENG, PRD, RES)
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => { onOpenChange(false); }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !name.trim() || (!isEditing && !key.trim())}>
              {isPending ? "Saving..." : isEditing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
