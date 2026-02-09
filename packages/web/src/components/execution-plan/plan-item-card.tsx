import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/common/status-badge";
import { cn } from "@/lib/utils";
import type { TaskPhaseItem, Status, User } from "@/lib/api/types";

interface PlanItemCardProps {
  item: TaskPhaseItem;
  status?: Status;
  complexity?: "trivial" | "simple" | "moderate" | "complex";
  assignee?: User;
  progress?: number; // 0-100
  className?: string;
}

const complexityColors: Record<string, string> = {
  trivial: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  simple: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  moderate: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  complex: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

export function PlanItemCard({
  item,
  status,
  complexity,
  assignee,
  progress = 0,
  className,
}: PlanItemCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    void navigate(`/features/${item.featureId}`);
  };

  // Generate initials from assignee name
  const getInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/).filter(p => p.length > 0);
    if (parts.length === 0) {
      return "?";
    }
    if (parts.length === 1) {
      const firstPart = parts[0];
      return firstPart ? firstPart.substring(0, 2).toUpperCase() : "?";
    }
    const first = parts[0]?.[0];
    const last = parts[parts.length - 1]?.[0];
    return (first && last) ? (first + last).toUpperCase() : "?";
  };

  return (
    <Card
      onClick={handleClick}
      className={cn(
        "p-4 cursor-pointer hover:shadow-md hover:border-primary/50 transition-all",
        "bg-card",
        className
      )}
    >
      {/* Header: Identifier + Status Badge */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono text-muted-foreground font-medium">
          {item.featureTitle}
        </span>
        {status && <StatusBadge status={status} />}
      </div>

      {/* Body: Task Title */}
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-foreground leading-snug">
          {item.title}
        </h4>
      </div>

      {/* Footer: Complexity + Assignee + Progress */}
      <div className="space-y-3">
        {/* Complexity Badge and Assignee */}
        <div className="flex items-center justify-between">
          {complexity && (
            <Badge
              className={cn(
                "text-xs font-medium",
                complexityColors[complexity]
              )}
            >
              {complexity}
            </Badge>
          )}
          
          {assignee && (
            <Avatar className="h-6 w-6">
              {assignee.avatarUrl && (
                <AvatarImage src={assignee.avatarUrl} alt={assignee.name} />
              )}
              <AvatarFallback className="text-xs">
                {getInitials(assignee.name)}
              </AvatarFallback>
            </Avatar>
          )}
        </div>

        {/* Progress Bar */}
        {progress > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span>{String(progress)}%</span>
            </div>
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${String(progress)}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
