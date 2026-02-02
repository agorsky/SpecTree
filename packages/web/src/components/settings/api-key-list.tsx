import { useState } from "react";
import { Key, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { ApiToken } from "@/lib/api/tokens";

// =============================================================================
// Types
// =============================================================================

interface ApiKeyListProps {
  tokens: ApiToken[];
  onRevoke: (id: string) => void;
  isRevoking?: boolean;
}

// =============================================================================
// Component
// =============================================================================

export function ApiKeyList({ tokens, onRevoke, isRevoking }: ApiKeyListProps) {
  const [tokenToRevoke, setTokenToRevoke] = useState<ApiToken | null>(null);

  const handleConfirmRevoke = () => {
    if (tokenToRevoke) {
      onRevoke(tokenToRevoke.id);
      setTokenToRevoke(null);
    }
  };

  if (tokens.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
        <Key className="h-8 w-8 mb-2 opacity-50" />
        <p>No API keys</p>
        <p className="text-sm">Create an API key to get started</p>
      </div>
    );
  }

  return (
    <>
      <div className="divide-y">
        {tokens.map((token) => (
          <div
            key={token.id}
            className="flex items-start justify-between py-4 first:pt-0 last:pb-0"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-md bg-muted p-2">
                <Key className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{token.name}</span>
                  {token.scopes.length > 0 && (
                    <span className="text-sm text-muted-foreground">
                      · {token.scopes.join(", ")}
                    </span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  Created {formatDistanceToNow(new Date(token.createdAt), { addSuffix: true })}
                  {" · "}
                  {token.lastUsedAt
                    ? `Last used ${formatDistanceToNow(new Date(token.lastUsedAt), { addSuffix: true })}`
                    : "never used"}
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setTokenToRevoke(token); }}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Revoke
            </Button>
          </div>
        ))}
      </div>

      {/* Revoke confirmation dialog */}
      <Dialog open={!!tokenToRevoke} onOpenChange={() => { setTokenToRevoke(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke API Key</DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke this API key? Any applications using
              this key will no longer be able to access the API.
            </DialogDescription>
          </DialogHeader>

          {tokenToRevoke && (
            <div className="rounded-md border p-4 bg-muted/50">
              <p className="font-medium">{tokenToRevoke.name}</p>
              <p className="text-sm text-muted-foreground">
                Created {formatDistanceToNow(new Date(tokenToRevoke.createdAt), { addSuffix: true })}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setTokenToRevoke(null); }}
              disabled={isRevoking}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmRevoke}
              disabled={isRevoking}
            >
              {isRevoking ? "Revoking..." : "Revoke Key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
