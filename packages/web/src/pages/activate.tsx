import { useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { authApi } from "@/lib/api/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, X } from "lucide-react";

export function ActivatePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setTokens, checkAuth } = useAuthStore();

  const [formData, setFormData] = useState({
    email: searchParams.get("email") ?? "",
    code: searchParams.get("code") ?? "",
    name: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const passwordRequirements = [
    { met: formData.password.length >= 8, text: "At least 8 characters" },
    { met: /[A-Z]/.test(formData.password), text: "One uppercase letter" },
    { met: /[a-z]/.test(formData.password), text: "One lowercase letter" },
    { met: /[0-9]/.test(formData.password), text: "One number" },
  ];

  const allRequirementsMet = passwordRequirements.every((r) => r.met);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!allRequirementsMet) {
      setError("Password does not meet requirements");
      return;
    }

    setIsLoading(true);

    const doActivate = async () => {
      try {
        const response = await authApi.activate({
          email: formData.email,
          code: formData.code,
          name: formData.name,
          password: formData.password,
        });

        // Store tokens using auth store
        setTokens(response.tokens.accessToken, response.tokens.refreshToken);
        
        // Fetch user info to complete authentication
        await checkAuth();

        // Navigate to home after successful activation
        void navigate("/");
      } catch (err: unknown) {
        if (err && typeof err === "object" && "data" in err) {
          const data = (err as { data: { message?: string } }).data;
          setError(data.message ?? "Activation failed");
        } else {
          setError("Activation failed. Please check your invitation code.");
        }
      } finally {
        setIsLoading(false);
      }
    };

    void doActivate();
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Activate Your Account</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="text-sm text-destructive">{error}</div>}

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => {
                  setFormData((d) => ({ ...d, email: e.target.value }));
                }}
                placeholder="your.name@company.com"
                disabled={!!searchParams.get("email")}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">Invitation Code</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => {
                  setFormData((d) => ({
                    ...d,
                    code: e.target.value.toUpperCase(),
                  }));
                }}
                placeholder="ABCD1234"
                maxLength={8}
                className="uppercase tracking-widest"
                disabled={!!searchParams.get("code")}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => {
                  setFormData((d) => ({ ...d, name: e.target.value }));
                }}
                placeholder="John Smith"
                minLength={2}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => {
                  setFormData((d) => ({ ...d, password: e.target.value }));
                }}
                required
              />
              <div className="mt-2 space-y-1">
                {passwordRequirements.map((req, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    {req.met ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <X className="h-4 w-4 text-gray-300" />
                    )}
                    <span
                      className={req.met ? "text-green-700" : "text-gray-500"}
                    >
                      {req.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => {
                  setFormData((d) => ({
                    ...d,
                    confirmPassword: e.target.value,
                  }));
                }}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Activating..." : "Activate Account"}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
