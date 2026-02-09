import { cn } from "@/lib/utils";
import type { TaskPhaseItem } from "@/lib/api/types";
import { Card } from "@/components/ui/card";

interface PhaseLaneProps {
  phaseKey: string;
  phaseNumber: number;
  items: TaskPhaseItem[];
}

export function PhaseLane({ phaseKey, phaseNumber, items }: PhaseLaneProps) {
  return (
    <div className="border-b last:border-b-0 pb-6 mb-6 last:pb-0 last:mb-0">
      {/* Phase Header */}
      <div className="mb-4 px-4">
        <h3 className="text-lg font-semibold text-foreground">
          Phase {String(phaseNumber)}
        </h3>
        {phaseKey !== `phase-${String(phaseNumber)}` && (
          <p className="text-sm text-muted-foreground">{phaseKey}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {items.length} {items.length === 1 ? "task" : "tasks"}
        </p>
      </div>

      {/* Items Grid - Horizontal layout on desktop, stacks on mobile */}
      {items.length > 0 ? (
        <div className={cn(
          "grid gap-4 px-4",
          // Mobile: single column (< 768px)
          "grid-cols-1",
          // Tablet and up: horizontal layout
          "md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        )}>
          {items.map((item) => (
            <Card
              key={item.id}
              data-task-id={item.id}
              className={cn(
                "p-4 hover:shadow-md transition-shadow",
                "bg-card"
              )}
            >
              <div className="space-y-2">
                {/* Feature Title */}
                <div className="text-xs font-medium text-muted-foreground">
                  {item.featureTitle}
                </div>
                
                {/* Task Title */}
                <div className="text-sm font-semibold text-foreground">
                  {item.title}
                </div>
                
                {/* Metadata */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {item.canParallelize && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                      Parallel
                    </span>
                  )}
                  {item.parallelGroup && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                      Group: {item.parallelGroup}
                    </span>
                  )}
                </div>

                {/* Dependencies */}
                {item.dependencies.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Depends on {item.dependencies.length} {item.dependencies.length === 1 ? "task" : "tasks"}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          No tasks in this phase
        </div>
      )}
    </div>
  );
}
