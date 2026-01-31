import { useState, useEffect, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { usersApi } from "@/lib/api/users";
import { adminApi } from "@/lib/api/admin";
import { useAuthStore } from "@/stores/auth-store";

interface AdminUser {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  isGlobalAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

interface EditUserDialogProps {
  user: AdminUser | null;
  open: boolean;
  onClose: () => void;
}

export function EditUserDialog({ user, open, onClose }: EditUserDialogProps) {
  const [name, setName] = useState("");
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();

  const isCurrentUser = user?.id === currentUser?.id;

  useEffect(() => {
    if (open && user) {
      setName(user.name);
      setIsGlobalAdmin(user.isGlobalAdmin);
      setError(null);
    }
  }, [open, user]);

  const updateUserName = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name: string } }) =>
      usersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (err: Error) => {
      setError(err.message || "Failed to update user");
    },
  });

  const updateUserAdmin = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { isGlobalAdmin: boolean } }) =>
      adminApi.updateUserAdmin(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (err: Error) => {
      setError(err.message || "Failed to update admin status");
    },
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    if (!user) return;

    try {
      // Update name if changed
      if (name.trim() !== user.name) {
        await updateUserName.mutateAsync({ id: user.id, data: { name: name.trim() } });
      }

      // Update admin status if changed
      if (isGlobalAdmin !== user.isGlobalAdmin) {
        await updateUserAdmin.mutateAsync({ id: user.id, data: { isGlobalAdmin } });
      }

      onClose();
    } catch {
      // Error already handled by mutation onError
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  const isPending = updateUserName.isPending || updateUserAdmin.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update user information. Email cannot be changed.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={user?.email ?? ""}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Email cannot be changed
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="User name"
              required
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="admin-toggle">Global Admin</Label>
              <p className="text-xs text-muted-foreground">
                {isCurrentUser
                  ? "You cannot change your own admin status"
                  : "Grant full administrative access"}
              </p>
            </div>
            <Checkbox
              id="admin-toggle"
              checked={isGlobalAdmin}
              onCheckedChange={(checked) => setIsGlobalAdmin(checked === true)}
              disabled={isCurrentUser}
            />
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
