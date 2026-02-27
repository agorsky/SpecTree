import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { useCurrentUser } from "@/hooks/queries/use-current-user";
import { Folder, Settings, LogOut, BarChart3, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

import { Badge } from "@/components/ui/badge";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/epic-requests", label: "Epic Requests", icon: Lightbulb },
  { href: "/epics", label: "Epics", icon: Folder },
  { href: "/settings", label: "Settings", icon: Settings },
];

const VERSION = "0.2.0";

export function Sidebar() {
  const location = useLocation();
  const logout = useAuthStore((s) => s.logout);
  const { data: currentUser } = useCurrentUser();
  const user = currentUser?.data;

  return (
    <div className="flex h-full w-64 flex-col border-r bg-muted/40">
      {/* Header */}
      <div className="flex h-14 items-center border-b px-4">
        <span className="font-semibold">Dispatcher</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              location.pathname === item.href ||
                location.pathname.startsWith(item.href + "/")
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}

      </nav>

      {/* User menu */}
      <div className="border-t p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start gap-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback>
                  {user?.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{user?.name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-56">
            <DropdownMenuItem onClick={logout}>
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        {/* Version Badge */}
        <div className="flex justify-center mt-2">
          <Link to="/whats-new">
            <Badge 
              variant="secondary" 
              className="text-xs cursor-pointer transition-colors hover:bg-secondary/80"
            >
              v{VERSION}
            </Badge>
          </Link>
        </div>
      </div>
    </div>
  );
}
