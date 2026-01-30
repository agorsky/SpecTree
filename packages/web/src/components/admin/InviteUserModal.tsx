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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminApi } from "@/lib/api/admin";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function InviteUserModal({ open, onClose }: Props) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [successCode, setSuccessCode] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const createInvitation = useMutation({
    mutationFn: () => adminApi.createInvitation({ email }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
      setSuccessCode(data.code);
      setEmail("");
      setError("");
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email) {
      setError("Email is required");
      return;
    }
    createInvitation.mutate();
  };

  const handleClose = () => {
    setEmail("");
    setError("");
    setSuccessCode(null);
    onClose();
  };

  const copyToClipboard = async () => {
    if (successCode) {
      await navigator.clipboard.writeText(successCode);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite New User</DialogTitle>
          <DialogDescription>
            Send an invitation to a new user to join the platform.
          </DialogDescription>
        </DialogHeader>

        {successCode ? (
          <div className="space-y-4">
            <div className="rounded-md bg-green-50 p-4 dark:bg-green-900/20">
              <p className="text-sm text-green-800 dark:text-green-200">
                Invitation created successfully!
              </p>
            </div>
            <div className="space-y-2">
              <Label>Invitation Code</Label>
              <div className="flex gap-2">
                <Input value={successCode} readOnly className="font-mono" />
                <Button variant="outline" onClick={copyToClipboard}>
                  Copy
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Share this code with the user to complete registration.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createInvitation.isPending}>
                {createInvitation.isPending ? "Creating..." : "Create Invitation"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
