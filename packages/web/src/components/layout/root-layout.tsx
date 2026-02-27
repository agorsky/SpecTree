import { Outlet } from "react-router-dom";
import { Header } from "./header";

export function RootLayout() {
  return (
    <div className="relative min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="container py-6">
          <Outlet />
        </div>
      </main>
      <footer className="border-t border-border py-6">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-10 md:flex-row">
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            Dispatcher - OpenAPI Spec Analysis Platform
          </p>
        </div>
      </footer>
    </div>
  );
}
