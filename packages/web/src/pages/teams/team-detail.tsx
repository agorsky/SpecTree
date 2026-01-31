import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTeam, useDeleteTeam } from "@/hooks/queries/use-teams";
import { useAuthStore } from "@/stores/auth-store";
import { MemberList } from "@/components/teams/member-list";
import { TeamForm } from "@/components/teams/team-form";
import { AddMemberModal } from "@/components/teams/add-member-modal";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Pencil, UserPlus, Trash2 } from "lucide-react";

export function TeamDetailPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { data: team, isLoading } = useTeam(teamId ?? "");
  const deleteTeam = useDeleteTeam();
  const { user } = useAuthStore();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted mb-6" />
        <div className="h-10 w-64 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Team not found</p>
        </div>
      </div>
    );
  }

  const handleDelete = async () => {
    await deleteTeam.mutateAsync(team.id);
    navigate("/teams");
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">{team.name}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => { setIsEditOpen(true); }}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => { setShowDeleteDialog(true); }}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium">Team Members</h2>
            <Button variant="outline" size="sm" onClick={() => setShowAddMember(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Add Member
            </Button>
          </div>
          <MemberList teamId={team.id} currentUserId={user?.id ?? ""} />
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-2">Workflow Statuses</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Configure the statuses available for features and tasks.
              </p>
              <div className="text-sm text-muted-foreground">
                Status configuration coming soon...
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <TeamForm team={team} open={isEditOpen} onOpenChange={setIsEditOpen} />

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Team</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{team.name}"? This will remove all
              members and archive all epics in this team. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
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

      {/* Add member modal */}
      <AddMemberModal
        teamId={team.id}
        open={showAddMember}
        onOpenChange={setShowAddMember}
      />
    </div>
  );
}
