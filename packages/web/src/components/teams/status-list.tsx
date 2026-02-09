import { useState } from "react";
import { useTeamStatuses, useDeleteTeamStatus } from "@/hooks/queries/use-teams";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Pencil, Trash2 } from "lucide-react";
import type { Status } from "@/lib/api/types";

interface StatusListProps {
  teamId: string;
  onEdit: (status: Status) => void;
}

export function StatusList({ teamId, onEdit }: StatusListProps) {
  const { data: statuses, isLoading, error } = useTeamStatuses(teamId);
  const deleteStatus = useDeleteTeamStatus();
  const [deleteConfirmStatus, setDeleteConfirmStatus] = useState<Status | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-lg bg-muted"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive">
        Failed to load statuses. Please try again.
      </div>
    );
  }

  if (!statuses || statuses.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No custom statuses configured yet. Create your first status to get started.
      </div>
    );
  }

  const handleDelete = async (status: Status) => {
    await deleteStatus.mutateAsync({ teamId, statusId: status.id });
    setDeleteConfirmStatus(null);
  };

  // Helper to get category display info
  const getCategoryVariant = (category: Status['category']) => {
    switch (category) {
      case 'backlog':
        return 'secondary';
      case 'unstarted':
        return 'secondary';
      case 'started':
        return 'default';
      case 'completed':
        return 'default';
      case 'canceled':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  return (
    <>
      <div className="space-y-2">
        {statuses.map((status) => (
          <div
            key={status.id}
            className="flex items-center justify-between p-3 rounded-lg border"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: status.color }}
              />
              <div>
                <div className="font-medium">{status.name}</div>
                <div className="text-sm text-muted-foreground">
                  Position: {status.position}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant={getCategoryVariant(status.category)}>
                {status.category}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEdit(status)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeleteConfirmStatus(status)}
                disabled={deleteStatus.isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteConfirmStatus}
        onOpenChange={(open) => !open && setDeleteConfirmStatus(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Status</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteConfirmStatus?.name}"? This
              status will be removed from all features and tasks. This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmStatus(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmStatus && void handleDelete(deleteConfirmStatus)}
              disabled={deleteStatus.isPending}
            >
              {deleteStatus.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
