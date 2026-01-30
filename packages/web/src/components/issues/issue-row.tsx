import { Link } from "react-router-dom";
import type { Feature, Task } from "@/lib/api/types";
import { StatusDot } from "@/components/common/status-dot";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { CircleDot, GitCommitVertical, CheckCircle2 } from "lucide-react";

type IssueItem =
  | { type: "feature"; data: Feature }
  | { type: "task"; data: Task };

interface IssueRowProps {
  item: IssueItem;
  className?: string;
  /** Whether this task is the last one under its parent feature */
  isLastTask?: boolean | undefined;
  /** Hide the status dot for features (used when grouped by status) */
  hideFeatureStatus?: boolean | undefined;
}

export function IssueRow({ item, className, isLastTask, hideFeatureStatus }: IssueRowProps) {
  const isFeature = item.type === "feature";
  const isTask = !isFeature;
  const data = item.data;

  // Tasks link to their parent feature (since there's no separate task detail page)
  const linkTo = isFeature
    ? `/features/${data.id}`
    : `/features/${(data as Task).featureId}`;
  const identifier = data.identifier;
  const title = data.title;
  const status = data.status;
  const assignee = data.assignee;

  // Check if item is completed or canceled
  const isCompleted = status?.category === "completed";
  const isCanceled = status?.category === "canceled";
  const isDone = isCompleted || isCanceled;

  // For features: show task count (completed/total)
  const taskCount = isFeature
    ? {
        total: (data as Feature)._count?.tasks ?? 0,
        completed: (data as Feature).completedTaskCount ?? 0,
      }
    : null;

  return (
    <Link
      to={linkTo}
      className={cn(
        "flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors group",
        isTask && "pl-8",
        isDone && "opacity-60",
        className
      )}
    >
      {/* Tree connector for tasks */}
      {isTask && (
        <span className="flex items-center text-muted-foreground/40 flex-shrink-0 -ml-4 w-4">
          {isLastTask ? (
            <svg width="16" height="24" viewBox="0 0 16 24" fill="none" className="text-border">
              <path d="M8 0V12H16" stroke="currentColor" strokeWidth="1.5" fill="none"/>
            </svg>
          ) : (
            <svg width="16" height="24" viewBox="0 0 16 24" fill="none" className="text-border">
              <path d="M8 0V24M8 12H16" stroke="currentColor" strokeWidth="1.5" fill="none"/>
            </svg>
          )}
        </span>
      )}

      {/* Icon: Status dot for features, status-aware icon for tasks */}
      {isFeature ? (
        hideFeatureStatus ? null : status ? (
          <StatusDot status={status} />
        ) : (
          <CircleDot className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        )
      ) : isCompleted ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
      ) : (
        <GitCommitVertical className="h-3.5 w-3.5 text-muted-foreground/60 flex-shrink-0 rotate-90" />
      )}

      {/* Identifier - narrower for tasks */}
      <span
        className={cn(
          "font-mono flex-shrink-0",
          isFeature
            ? "text-xs text-muted-foreground w-16"
            : "text-[11px] text-muted-foreground/70 w-20"
        )}
      >
        {identifier}
      </span>

      {/* Title - muted for tasks, strikethrough for completed */}
      <span
        className={cn(
          "flex-1 truncate text-sm",
          isFeature ? "font-medium" : "font-normal text-muted-foreground",
          isDone && "line-through"
        )}
      >
        {title}
      </span>

      {/* Task count for features */}
      {isFeature && taskCount && taskCount.total > 0 && (
        <span className="text-xs text-muted-foreground flex-shrink-0 tabular-nums">
          {taskCount.completed}/{taskCount.total}
        </span>
      )}

      {/* Assignee avatar */}
      {assignee && (
        <Avatar className={cn("flex-shrink-0", isFeature ? "h-5 w-5" : "h-4 w-4")}>
          <AvatarFallback className={cn(isFeature ? "text-[10px]" : "text-[8px]")}>
            {assignee.name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      )}
    </Link>
  );
}
