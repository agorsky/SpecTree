import { useTeamMembers, useRemoveTeamMember } from "@/hooks/queries/use-teams";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";

interface MemberListProps {
  teamId: string;
  currentUserId: string;
}

export function MemberList({ teamId, currentUserId }: MemberListProps) {
  const { data: members, isLoading } = useTeamMembers(teamId);
  const removeMember = useRemoveTeamMember();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-lg bg-muted"
          />
        ))}
      </div>
    );
  }

  if (!members || members.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No members in this team
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {members.map((member) => (
        <div
          key={member.id}
          className="flex items-center justify-between p-3 rounded-lg border"
        >
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback>
                {member.user?.name?.charAt(0)?.toUpperCase() ?? "?"}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium">{member.user?.name ?? "Unknown"}</div>
              <div className="text-sm text-muted-foreground">{member.user?.email ?? ""}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={member.role === "admin" ? "default" : "secondary"}>
              {member.role}
            </Badge>
            {member.user?.id !== currentUserId && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  removeMember.mutate({ teamId, userId: member.user?.id ?? "" });
                }}
                disabled={removeMember.isPending || !member.user?.id}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
