import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { adminApi } from "@/lib/api/admin";
import { teamsApi } from "@/lib/api/teams";
import { useTeamMembers, teamKeys } from "@/hooks/queries/use-teams";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Check, User } from "lucide-react";

interface AddMemberModalProps {
  teamId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddMemberModal({ teamId, open, onOpenChange }: AddMemberModalProps) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Get all users (admin only endpoint)
  const { data: usersResponse, isLoading: loadingUsers } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => adminApi.listUsers({ limit: 100 }),
    enabled: open,
  });

  // Get current team members using the same hook/query key as MemberList
  const { data: members, isLoading: loadingMembers } = useTeamMembers(teamId);

  const addMember = useMutation({
    mutationFn: (userId: string) => teamsApi.addMember(teamId, userId),
    onSuccess: () => {
      // Use the same query key that useTeamMembers uses
      queryClient.invalidateQueries({ queryKey: teamKeys.members(teamId) });
      onOpenChange(false);
      setSelectedUserId(null);
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message || "Failed to add member");
    },
  });

  const handleAdd = () => {
    if (!selectedUserId) return;
    setError(null);
    addMember.mutate(selectedUserId);
  };

  const handleClose = () => {
    setSelectedUserId(null);
    setError(null);
    onOpenChange(false);
  };

  // Filter out users who are already members
  const currentMemberIds = new Set(members?.map((m) => m.user.id) ?? []);
  const availableUsers = usersResponse?.users?.filter(
    (u) => u.isActive && !currentMemberIds.has(u.id)
  ) ?? [];

  const isLoading = loadingUsers || loadingMembers;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Team Member</DialogTitle>
          <DialogDescription>
            Select a user to add to this team.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : availableUsers.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No users available to add. All active users are already members.
            </p>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {availableUsers.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => setSelectedUserId(user.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-md text-left transition-colors",
                    selectedUserId === user.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  )}
                >
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{user.name}</p>
                    <p className={cn(
                      "text-sm truncate",
                      selectedUserId === user.id
                        ? "text-primary-foreground/70"
                        : "text-muted-foreground"
                    )}>
                      {user.email}
                    </p>
                  </div>
                  {selectedUserId === user.id && (
                    <Check className="h-5 w-5 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}

          {error && (
            <div className="mt-4 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={!selectedUserId || addMember.isPending}
          >
            {addMember.isPending ? "Adding..." : "Add Member"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
