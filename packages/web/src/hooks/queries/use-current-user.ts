import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { usersApi } from "@/lib/api/users";
import type { User } from "@/lib/api/types";

export function useCurrentUser() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery<{ data: User }>({
    queryKey: ["current-user"],
    queryFn: () => usersApi.me(),
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
