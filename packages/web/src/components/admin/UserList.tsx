import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserX, UserCheck, Pencil, Search, Trash2 } from "lucide-react";
import { adminApi } from "@/lib/api/admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { EditUserDialog } from "./EditUserDialog";
import { DeleteUserDialog } from "./DeleteUserDialog";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);

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

  const deleteUser = useMutation({
    mutationFn: adminApi.deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      setDeletingUser(null);
    },
  });

  const users = data?.users ?? [];

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const query = searchQuery.toLowerCase();
    return users.filter(
      (user: AdminUser) =>
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
    );
  }, [users, searchQuery]);

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

  return (
    <div className="space-y-4">
      {/* Search filter */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search users by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* User list */}
      {filteredUsers.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          {searchQuery ? "No users match your search." : "No users found."}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredUsers.map((user: AdminUser) => (
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
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingUser(user)}
                  title="Edit user"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                {!user.isGlobalAdmin && (
                  <>
                    {user.isActive ? (
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
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeletingUser(user)}
                      title="Delete user"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <EditUserDialog
        user={editingUser}
        open={!!editingUser}
        onClose={() => setEditingUser(null)}
      />

      {/* Delete confirmation dialog */}
      <DeleteUserDialog
        user={deletingUser}
        open={!!deletingUser}
        onClose={() => setDeletingUser(null)}
        onConfirm={() => deletingUser && deleteUser.mutate(deletingUser.id)}
        isDeleting={deleteUser.isPending}
      />
    </div>
  );
}
