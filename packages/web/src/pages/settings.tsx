import { useState } from "react";
import { Plus } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useTheme } from "@/hooks/use-theme";
import { useTokens, useRevokeToken } from "@/hooks/queries/use-tokens";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiKeyList } from "@/components/settings/api-key-list";
import { CreateApiKeyDialog } from "@/components/settings/create-api-key-dialog";

export function SettingsPage() {
  const { user, logout } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState(user?.name ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [isCreateKeyDialogOpen, setIsCreateKeyDialogOpen] = useState(false);

  // API Keys
  const { data: tokens, isLoading: isLoadingTokens } = useTokens();
  const revokeToken = useRevokeToken();

  const handleSaveProfile = () => {
    setIsSaving(true);
    // TODO: Implement profile update API
    console.log("Save profile:", { name });
    setTimeout(() => { setIsSaving(false); }, 500);
  };

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold mb-6">Settings</h1>

      {/* Profile Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Manage your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user?.email ?? ""} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Display Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => { setName(e.target.value); }}
            />
          </div>
          <Button onClick={() => { handleSaveProfile(); }} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>

      {/* Preferences Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>Customize your experience</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Dark Mode</div>
              <div className="text-sm text-muted-foreground">
                Use dark theme
              </div>
            </div>
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Personal API Keys Section */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Personal API keys</CardTitle>
              <CardDescription>
                Use SpecTree's API to build your own integrations
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => { setIsCreateKeyDialogOpen(true); }}
            >
              <Plus className="h-4 w-4 mr-1" />
              New API key
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingTokens ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              Loading API keys...
            </div>
          ) : (
            <>
              {tokens && tokens.length > 0 && (
                <div className="text-sm text-muted-foreground mb-4">
                  {tokens.length} API {tokens.length === 1 ? "key" : "keys"}
                </div>
              )}
              <ApiKeyList
                tokens={tokens ?? []}
                onRevoke={(id) => { revokeToken.mutate(id); }}
                isRevoking={revokeToken.isPending}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Create API Key Dialog */}
      <CreateApiKeyDialog
        open={isCreateKeyDialogOpen}
        onOpenChange={setIsCreateKeyDialogOpen}
      />

      {/* Session */}
      <Card>
        <CardHeader>
          <CardTitle>Session</CardTitle>
          <CardDescription>Manage your current session</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => { logout(); }}>
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
