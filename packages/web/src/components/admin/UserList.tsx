import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserX, UserCheck } from "lucide-react";
import { adminApi } from "@/lib/api/admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface AdminUser {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  isGlobalAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

export function UserList() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => adminApi.listUsers(),
  });

  const deactivateUser = useMutation({
    mutationFn: adminApi.deactivateUser,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
  });

  const reactivateUser = useMutation({
    mutationFn: adminApi.reactivateUser,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        Loading users...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-8 text-destructive">
        Failed to load users
      </div>
    );
  }

  const users = data?.users ?? [];

  if (users.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        No users found.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {users.map((user: AdminUser) => (
        <div
          key={user.id}
          className="flex items-center justify-between rounded-lg border p-4"
        >
          <div className="flex items-center gap-4">
            <Avatar>
              <AvatarFallback>
                {user.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <p className="font-medium">{user.name}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user.isGlobalAdmin && (
              <Badge variant="secondary">Admin</Badge>
            )}
            <Badge variant={user.isActive ? "default" : "destructive"}>
              {user.isActive ? "Active" : "Deactivated"}
            </Badge>
            {!user.isGlobalAdmin && (
              user.isActive ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deactivateUser.mutate(user.id)}
                  disabled={deactivateUser.isPending}
                  title="Deactivate user"
                >
                  <UserX className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => reactivateUser.mutate(user.id)}
                  disabled={reactivateUser.isPending}
                  title="Reactivate user"
                >
                  <UserCheck className="h-4 w-4" />
                </Button>
              )
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
