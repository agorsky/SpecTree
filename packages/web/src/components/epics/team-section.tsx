import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface TeamSectionProps {
  teamName: string;
  epicCount: number;
  defaultExpanded?: boolean;
  children: ReactNode;
}

/**
 * TeamSection component for grouping epics by team.
 * Provides a collapsible section with team name, epic count, and chevron indicator.
 * 
 * @param teamName - The name of the team
 * @param epicCount - Number of epics in this team
 * @param defaultExpanded - Whether the section is expanded by default (default: true)
 * @param children - Epic grid content to display when expanded
 */
export function TeamSection({
  teamName,
  epicCount,
  defaultExpanded = true,
  children,
}: TeamSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultExpanded);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-4">
      <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-3 hover:bg-muted/50 rounded-lg transition-colors group min-h-[44px] sm:px-4">
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          <h2 className="text-xl font-bold text-foreground sm:text-2xl truncate">
            {teamName}
          </h2>
          <span className="text-xs font-medium text-muted-foreground px-2 py-0.5 bg-muted rounded-full border border-border shrink-0 sm:text-sm sm:px-3 sm:py-1">
            {epicCount}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "h-5 w-5 text-muted-foreground transition-transform duration-200 shrink-0 motion-reduce:transition-none",
            isOpen && "rotate-180"
          )}
        />
      </CollapsibleTrigger>

      <CollapsibleContent className="overflow-hidden transition-all duration-300 data-[state=closed]:animate-out data-[state=open]:animate-in motion-reduce:transition-none">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
