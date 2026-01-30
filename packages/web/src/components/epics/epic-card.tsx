import { useState } from "react";
import { Link } from "react-router-dom";
import type { Epic } from "@/lib/api/types";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Folder, MoreVertical, Trash2, Pencil } from "lucide-react";
import { useDeleteEpic } from "@/hooks/queries/use-epics";
import { ApiError } from "@/lib/api/client";

interface EpicCardProps {
  epic: Epic;
  onEdit?: (epic: Epic) => void;
}

export function EpicCard({ epic, onEdit }: EpicCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [error, setError] = useState("");
  const deleteEpic = useDeleteEpic();

  const handleDelete = async () => {
    setError("");
    try {
      await deleteEpic.mutateAsync(epic.id);
      setShowDeleteDialog(false);
    } catch (err: unknown) {
      console.error("Delete epic error:", err);
      if (err instanceof ApiError) {
        const data = err.data as { error?: { message?: string } } | undefined;
        setError(data?.error?.message || `Error ${err.response.status}: Failed to delete epic`);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to delete epic");
      }
    }
  };

  return (
    <>
      <Card className="hover:bg-muted/50 transition-colors cursor-pointer group relative">
        <Link to={`/epics/${epic.id}`}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Folder className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <CardTitle className="text-base truncate">{epic.name}</CardTitle>
                {epic.description && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <CardDescription className="truncate cursor-help">
                        {epic.description}
                      </CardDescription>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" align="start">
                      <p className="max-w-sm">{epic.description}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
          </CardHeader>
        </Link>
        
        {/* Actions dropdown */}
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onEdit && (
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(epic);
                  }}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteDialog(true);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Card>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Epic</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{epic.name}"? This will also
              delete all features and tasks in this epic. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {error && <div className="text-sm text-destructive">{error}</div>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={deleteEpic.isPending}
            >
              {deleteEpic.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
