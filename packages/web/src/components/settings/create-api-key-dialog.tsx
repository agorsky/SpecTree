import { useState } from "react";
import { Copy, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useCreateToken } from "@/hooks/queries/use-tokens";

// =============================================================================
// Types
// =============================================================================

interface CreateApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// =============================================================================
// Component
// =============================================================================

export function CreateApiKeyDialog({ open, onOpenChange }: CreateApiKeyDialogProps) {
  const [name, setName] = useState("");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const createToken = useCreateToken();

  const handleCreate = async () => {
    if (!name.trim()) return;

    try {
      const result = await createToken.mutateAsync({ name: name.trim() });
      setCreatedToken(result.token);
    } catch {
      // Error handling is managed by the mutation
    }
  };

  const handleCopy = async () => {
    if (!createdToken) return;
    
    try {
      await navigator.clipboard.writeText(createdToken);
      setCopied(true);
      setTimeout(() => { setCopied(false); }, 2000);
    } catch {
      // Fallback for older browsers using selection API
      const textArea = document.createElement("textarea");
      textArea.value = createdToken;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        document.execCommand("copy");
      } catch {
        // Ignore copy failures in fallback
      }
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => { setCopied(false); }, 2000);
    }
  };

  const handleClose = () => {
    // Reset state when dialog closes
    setName("");
    setCreatedToken(null);
    setCopied(false);
    createToken.reset();
    onOpenChange(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    // If closing and we have a created token, use handleClose to reset
    if (!newOpen && createdToken) {
      handleClose();
    } else if (!newOpen) {
      // Just closing without a token, reset form
      setName("");
      createToken.reset();
      onOpenChange(false);
    } else {
      onOpenChange(newOpen);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        {!createdToken ? (
          // Creation form
          <>
            <DialogHeader>
              <DialogTitle>Create API Key</DialogTitle>
              <DialogDescription>
                Create a new API key for programmatic access to SpecTree.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="key-name">Name</Label>
                <Input
                  id="key-name"
                  placeholder="e.g., CopilotCLI, CI/CD Pipeline"
                  value={name}
                  onChange={(e) => { setName(e.target.value); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && name.trim()) {
                      void handleCreate();
                    }
                  }}
                  disabled={createToken.isPending}
                />
                <p className="text-sm text-muted-foreground">
                  Give your API key a memorable name to identify its purpose.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={createToken.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={() => { void handleCreate(); }}
                disabled={!name.trim() || createToken.isPending}
              >
                {createToken.isPending ? "Creating..." : "Create API Key"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          // Success - show the token
          <>
            <DialogHeader>
              <DialogTitle>API Key Created</DialogTitle>
              <DialogDescription>
                Your new API key has been created successfully.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="flex items-center gap-2 p-3 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <p className="text-sm">
                  Copy this key now. You won't be able to see it again!
                </p>
              </div>

              <div className="space-y-2">
                <Label>Your API Key</Label>
                <div className="flex gap-2">
                  <Input
                    value={createdToken}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => { void handleCopy(); }}
                    className="flex-shrink-0"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleClose}>
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
