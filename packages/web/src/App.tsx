import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { RouterProvider } from "react-router-dom";
import { ThemeProvider } from "@/hooks/use-theme";
import { router } from "@/router";
import { useAuthStore } from "@/stores/auth-store";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 1,
    },
  },
});

function App(): React.ReactNode {
  const checkAuth = useAuthStore((state) => state.checkAuth);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="spectree-ui-theme">
        <RouterProvider router={router} />
      </ThemeProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

export default App;
