import { RouterProvider } from "react-router-dom";
import { ThemeProvider } from "@/hooks/use-theme";
import { router } from "@/router";

function App(): React.ReactNode {
  return (
    <ThemeProvider defaultTheme="system" storageKey="spectree-ui-theme">
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}

export default App;
