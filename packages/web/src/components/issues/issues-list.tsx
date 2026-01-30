import { useState, useMemo } from "react";
import { useIssues, type IssueItem } from "@/hooks/queries/use-issues";
import { IssueRow } from "./issue-row";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Circle, CheckCircle2 } from "lucide-react";
import type { Status } from "@/lib/api/types";

interface IssuesListProps {
  epicId: string;
  className?: string;
}

// Status category display order
const categoryOrder: Status["category"][] = ["started", "unstarted", "backlog", "completed", "canceled"];

const categoryIcons: Record<Status["category"], React.ReactNode> = {
  started: <Circle className="h-4 w-4 text-yellow-500 fill-yellow-500/30" />,
  unstarted: <Circle className="h-4 w-4 text-blue-500" />,
  backlog: <Circle className="h-4 w-4 text-gray-400" />,
  completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  canceled: <Circle className="h-4 w-4 text-red-500" />,
};

interface StatusGroup {
  status: Status;
  items: IssueItem[];
  featureCount: number;
}

export function IssuesList({ epicId, className }: IssuesListProps) {
  const { data: issues, isLoading, error } = useIssues({ epicId });
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Group issues by feature status
  const groupedIssues = useMemo(() => {
    if (!issues) return [];

    const groups = new Map<string, StatusGroup>();
    
    // First pass: identify features and create groups
    for (const item of issues) {
      if (item.type === "feature" && item.data.status) {
        const statusId = item.data.status.id;
        if (!groups.has(statusId)) {
          groups.set(statusId, {
            status: item.data.status,
            items: [],
            featureCount: 0,
          });
        }
      }
    }

    // Second pass: add items to groups (features and their tasks together)
    let currentStatusId: string | null = null;
    for (const item of issues) {
      if (item.type === "feature") {
        currentStatusId = item.data.status?.id ?? null;
        if (currentStatusId && groups.has(currentStatusId)) {
          groups.get(currentStatusId)!.items.push(item);
          groups.get(currentStatusId)!.featureCount++;
        }
      } else if (item.type === "task" && currentStatusId && groups.has(currentStatusId)) {
        // Tasks go with their parent feature's group
        groups.get(currentStatusId)!.items.push(item);
      }
    }

    // Sort groups by category order, then by status position
    return Array.from(groups.values()).sort((a, b) => {
      const aOrder = categoryOrder.indexOf(a.status.category);
      const bOrder = categoryOrder.indexOf(b.status.category);
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.status.position - b.status.position;
    });
  }, [issues]);

  const toggleGroup = (statusId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(statusId)) {
        next.delete(statusId);
      } else {
        next.add(statusId);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className={cn("divide-y", className)}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="h-2.5 w-2.5 rounded-full bg-muted animate-pulse" />
              <div className="h-4 w-12 rounded bg-muted animate-pulse" />
              <div className="h-4 flex-1 rounded bg-muted animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Failed to load issues
      </div>
    );
  }

  if (!issues || issues.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No issues found. Create your first feature to get started.
      </div>
    );
  }

  return (
    <div className={className}>
      {groupedIssues.map((group) => {
        const isCollapsed = collapsedGroups.has(group.status.id);
        
        // Determine which tasks are the last under their parent feature within this group
        const isLastTaskMap = new Map<string, boolean>();
        for (let i = 0; i < group.items.length; i++) {
          const currentItem = group.items[i];
          if (currentItem && currentItem.type === "task") {
            const nextItem = group.items[i + 1];
            const isLast = !nextItem || nextItem.type === "feature";
            isLastTaskMap.set(currentItem.data.id, isLast);
          }
        }

        return (
          <div key={group.status.id} className="border-b last:border-b-0">
            {/* Status group header */}
            <button
              onClick={() => toggleGroup(group.status.id)}
              className="w-full flex items-center gap-2 px-4 py-2 hover:bg-muted/50 transition-colors text-left sticky top-0 bg-background z-10"
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
              {categoryIcons[group.status.category]}
              <span className="font-medium text-sm">{group.status.name}</span>
              <span className="text-xs text-muted-foreground">{group.featureCount}</span>
            </button>
            
            {/* Items in this group */}
            {!isCollapsed && (
              <div className="divide-y">
                {group.items.map((item) => (
                  <IssueRow
                    key={`${item.type}-${item.data.id}`}
                    item={item}
                    isLastTask={item.type === "task" ? isLastTaskMap.get(item.data.id) ?? false : undefined}
                    hideFeatureStatus
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
