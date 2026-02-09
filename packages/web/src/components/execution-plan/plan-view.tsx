import { useExecutionPlan } from "@/hooks/queries/use-execution-plan";
import { PhaseLane } from "./phase-lane";
import { DependencyArrows } from "./dependency-arrows";
import { Loader2, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useRef } from "react";

interface PlanViewProps {
  epicId: string;
}

export function PlanView({ epicId }: PlanViewProps) {
  const { data: executionPlan, isLoading, error } = useExecutionPlan(epicId);
  const containerRef = useRef<HTMLDivElement>(null);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading execution plan...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="m-4 p-4 border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900 dark:text-red-100">Error</h3>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
              Failed to load execution plan. Please try again.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  // No data state
  if (!executionPlan) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>No execution plan available for this epic.</p>
      </div>
    );
  }

  // Empty phases state
  if (executionPlan.phases.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>This epic has no phases yet.</p>
        <p className="text-sm mt-2">Add features with execution orders to see them here.</p>
      </div>
    );
  }

  // Main render: phases stack vertically
  return (
    <div ref={containerRef} className="relative py-6">
      {/* Dependency arrows overlay */}
      {executionPlan && (
        <DependencyArrows
          executionPlan={executionPlan}
          containerRef={containerRef}
        />
      )}
      
      <div className="space-y-0">
        {executionPlan.phases.map((phase, index) => (
          <PhaseLane
            key={phase.phaseKey}
            phaseKey={phase.phaseKey}
            phaseNumber={index + 1}
            items={phase.items}
          />
        ))}
      </div>
    </div>
  );
}
