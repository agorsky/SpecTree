import { Link } from "react-router-dom";
import type { Feature } from "@/lib/api/types";
import { StatusDot } from "@/components/common/status-dot";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface FeatureListItemProps {
  feature: Feature;
  showStatus?: boolean;
}

export function FeatureListItem({ feature, showStatus = true }: FeatureListItemProps) {
  const taskCount = feature._count?.tasks ?? 0;
  const completedCount = feature.completedTaskCount ?? 0;

  return (
    <Link
      to={`/features/${feature.id}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
    >
      {showStatus && feature.status && <StatusDot status={feature.status} />}
      <span className="text-xs text-muted-foreground font-mono flex-shrink-0 w-16">
        {feature.identifier}
      </span>
      <span className="font-medium truncate text-sm">{feature.title}</span>
      {taskCount > 0 && (
        <span className="text-xs text-muted-foreground flex-shrink-0 tabular-nums ml-2">
          {completedCount}/{taskCount}
        </span>
      )}
      <span className="flex-1" />
      {feature.assignee && (
        <Avatar className="h-5 w-5 flex-shrink-0">
          <AvatarFallback className="text-[10px]">
            {feature.assignee.name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      )}
    </Link>
  );
}
