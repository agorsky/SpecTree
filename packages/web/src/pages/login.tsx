import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();

  useEffect(() => {
    const doLogin = async () => {
      try {
        await login("");
        void navigate("/dashboard");
      } catch {
        // Should not happen in open auth mode
        void navigate("/dashboard");
      }
    };
    void doLogin();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">Signing in...</p>
    </div>
  );
}
