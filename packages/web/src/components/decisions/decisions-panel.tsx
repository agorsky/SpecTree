import React from "react";
import { useDecisions } from "@/hooks/queries/use-decisions";
import DecisionsList from "./decisions-list";

interface DecisionsPanelProps {
  epicId?: string;
  featureId?: string;
  taskId?: string;
}

const DecisionsPanel: React.FC<DecisionsPanelProps> = ({ epicId, featureId, taskId }) => {
  // Build filter object
  const filters = React.useMemo(() => {
    const f: any = {};
    if (epicId) f.epicId = epicId;
    if (featureId) f.featureId = featureId;
    if (taskId) f.taskId = taskId;
    return f;
  }, [epicId, featureId, taskId]);

  const { data, isLoading, isError, error } = useDecisions(filters);

  if (isLoading) {
    return (
      <div className="w-full max-w-2xl mx-auto py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4" />
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="w-full max-w-2xl mx-auto py-8 text-center text-red-500">
        Error loading decisions: {error instanceof Error ? error.message : "Unknown error"}
      </div>
    );
  }

  // API returns { decisions, count }
  const decisions = data?.decisions || [];

  if (!decisions.length) {
    return (
      <div className="w-full max-w-2xl mx-auto py-8 text-center text-gray-500">
        No decisions recorded
      </div>
    );
  }

  return <DecisionsList decisions={decisions} />;
};

export default DecisionsPanel;
