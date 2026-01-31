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
  const [successData, setSuccessData] = useState<{ code: string; email: string } | null>(null);
  const queryClient = useQueryClient();

  const createInvitation = useMutation({
    mutationFn: () => adminApi.createInvitation({ email }),
    onSuccess: (response: unknown) => {
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
      // API returns { data: invitation }, so access response.data.code
      const { data } = response as { data: { code: string } };
      setSuccessData({ code: data.code, email });
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
    setSuccessData(null);
    onClose();
  };

  const getActivationUrl = () => {
    if (!successData) return "";
    const baseUrl = window.location.origin;
    return `${baseUrl}/activate?email=${encodeURIComponent(successData.email)}&code=${successData.code}`;
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(getActivationUrl());
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

        {successData ? (
          <div className="space-y-4">
            <div className="rounded-md bg-green-50 p-4 dark:bg-green-900/20">
              <p className="text-sm text-green-800 dark:text-green-200">
                Invitation created successfully!
              </p>
            </div>
            <div className="space-y-2">
              <Label>Activation Link</Label>
              <div className="flex gap-2">
                <Input value={getActivationUrl()} readOnly className="font-mono text-xs" />
                <Button variant="outline" onClick={copyToClipboard}>
                  Copy
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Share this link with the user to complete registration.
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
