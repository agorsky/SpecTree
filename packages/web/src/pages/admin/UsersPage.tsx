import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { InviteUserModal } from "@/components/admin/InviteUserModal";
import { InvitationList } from "@/components/admin/InvitationList";
import { UserList } from "@/components/admin/UserList";

export function AdminUsersPage() {
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">User Management</h1>
        <Button onClick={() => setInviteModalOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Invite User
        </Button>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Active Users</TabsTrigger>
          <TabsTrigger value="invitations">Invitations</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <UserList />
        </TabsContent>

        <TabsContent value="invitations">
          <InvitationList />
        </TabsContent>
      </Tabs>

      <InviteUserModal
        open={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
      />
    </div>
  );
}
