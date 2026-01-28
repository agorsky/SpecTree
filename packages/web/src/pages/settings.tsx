import { useState } from "react";
import { useAuthStore } from "@/stores/auth-store";
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

export function SettingsPage() {
  const { user, logout } = useAuthStore();
  const [name, setName] = useState(user?.name ?? "");
  const [isSaving, setIsSaving] = useState(false);

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
            <div className="text-sm text-muted-foreground">
              Coming soon...
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => { logout(); }}>
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
