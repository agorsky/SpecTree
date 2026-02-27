import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Trash2, Clock, Check, X } from "lucide-react";
import { adminApi } from "@/lib/api/admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Invitation {
  id: string;
  email: string;
  code: string;
  expiresAt: string;
  usedAt: string | null;
}

type StatusInfo = {
  label: string;
  variant: "default" | "secondary" | "destructive";
  Icon: typeof Check;
};

function getStatus(inv: Invitation): StatusInfo {
  if (inv.usedAt) return { label: "Used", variant: "secondary", Icon: Check };
  if (new Date(inv.expiresAt) < new Date())
    return { label: "Expired", variant: "destructive", Icon: X };
  return { label: "Pending", variant: "default", Icon: Clock };
}

export function InvitationList() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["invitations"],
    queryFn: () => adminApi.listInvitations(),
  });

  const revokeInvitation = useMutation({
    mutationFn: adminApi.revokeInvitation,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["invitations"] }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        Loading invitations...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-8 text-destructive">
        Failed to load invitations
      </div>
    );
  }

  const invitations = data?.invitations ?? [];

  if (invitations.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        No invitations found. Click "Invite User" to create one.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {invitations.map((inv: Invitation) => {
        const status = getStatus(inv);
        const isPending = status.label === "Pending";
        return (
          <div
            key={inv.id}
            className="flex items-center justify-between rounded-lg border p-4"
          >
            <div className="space-y-1">
              <p className="font-medium">{inv.email}</p>
              <p className="text-sm text-muted-foreground">
                Code: <span className="font-mono">{inv.code}</span>
                {" • "}
                {new Date(inv.expiresAt) > new Date()
                  ? `Expires ${formatDistanceToNow(new Date(inv.expiresAt), { addSuffix: true })}`
                  : `Expired ${formatDistanceToNow(new Date(inv.expiresAt), { addSuffix: true })}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={status.variant}>
                <status.Icon className="mr-1 h-3 w-3" />
                {status.label}
              </Badge>
              {isPending && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => revokeInvitation.mutate(inv.id)}
                    disabled={revokeInvitation.isPending}
                    title="Revoke invitation"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
