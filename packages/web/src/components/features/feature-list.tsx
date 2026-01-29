import { useMemo, useState } from "react";
import { useFeatures } from "@/hooks/queries/use-features";
import type { FeatureFilters } from "@/lib/api/features";
import type { Feature, Status } from "@/lib/api/types";
import { FeatureListItem } from "./feature-list-item";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Circle, CheckCircle2 } from "lucide-react";

interface FeatureListProps {
  filters?: FeatureFilters;
}

// Status category display order and icons
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
  features: Feature[];
}

export function FeatureList({ filters }: FeatureListProps) {
  const {
    data,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useFeatures(filters);

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const features = data?.pages.flatMap((page) => page.data) ?? [];

  // Group features by status
  const groupedFeatures = useMemo(() => {
    const groups = new Map<string, StatusGroup>();
    
    for (const feature of features) {
      if (!feature.status) continue;
      
      const statusId = feature.status.id;
      if (!groups.has(statusId)) {
        groups.set(statusId, {
          status: feature.status,
          features: [],
        });
      }
      groups.get(statusId)!.features.push(feature);
    }

    // Sort groups by category order, then by status position
    return Array.from(groups.values()).sort((a, b) => {
      const aOrder = categoryOrder.indexOf(a.status.category);
      const bOrder = categoryOrder.indexOf(b.status.category);
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.status.position - b.status.position;
    });
  }, [features]);

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
      <div className="p-4 space-y-2">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-md bg-muted"
          />
        ))}
      </div>
    );
  }

  if (features.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No features found
      </div>
    );
  }

  return (
    <div>
      {groupedFeatures.map((group) => {
        const isCollapsed = collapsedGroups.has(group.status.id);
        
        return (
          <div key={group.status.id} className="border-b last:border-b-0">
            {/* Status group header */}
            <button
              onClick={() => toggleGroup(group.status.id)}
              className="w-full flex items-center gap-2 px-4 py-2 hover:bg-muted/50 transition-colors text-left"
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
              {categoryIcons[group.status.category]}
              <span className="font-medium text-sm">{group.status.name}</span>
              <span className="text-xs text-muted-foreground">{group.features.length}</span>
            </button>
            
            {/* Features in this group */}
            {!isCollapsed && (
              <div className="divide-y">
                {group.features.map((feature) => (
                  <FeatureListItem key={feature.id} feature={feature} showStatus={false} />
                ))}
              </div>
            )}
          </div>
        );
      })}
      
      {hasNextPage && (
        <div className="p-4">
          <Button
            variant="ghost"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="w-full"
          >
            {isFetchingNextPage ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
