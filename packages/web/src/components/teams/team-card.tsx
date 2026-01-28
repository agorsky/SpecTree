import { useState } from "react";
import { Link } from "react-router-dom";
import type { Team } from "@/lib/api/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
import { Users, MoreVertical, Trash2 } from "lucide-react";
import { useDeleteTeam } from "@/hooks/queries/use-teams";
import { ApiError } from "@/lib/api/client";

interface TeamCardProps {
  team: Team;
  memberCount?: number;
}

export function TeamCard({ team, memberCount }: TeamCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [error, setError] = useState("");
  const deleteTeam = useDeleteTeam();

  const handleDelete = async () => {
    setError("");
    try {
      await deleteTeam.mutateAsync(team.id);
      setShowDeleteDialog(false);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        const data = err.data as { error?: { message?: string } } | undefined;
        setError(data?.error?.message || `Error ${err.response.status}: Failed to delete team`);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to delete team");
      }
    }
  };

  return (
    <>
      <Card className="hover:bg-muted/50 transition-colors cursor-pointer group relative">
        <Link to={`/teams/${team.id}`}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-base">{team.name}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Users className="h-4 w-4" />
              <span>{memberCount ?? "..."} members</span>
            </div>
          </CardContent>
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
            <DialogTitle>Delete Team</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{team.name}"? This will also
              delete all projects, features, and tasks in this team. This action cannot be undone.
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
              disabled={deleteTeam.isPending}
            >
              {deleteTeam.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
