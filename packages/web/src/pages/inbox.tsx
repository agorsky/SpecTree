import { useState } from "react";
import { FeatureList } from "@/components/features/feature-list";
import { FeatureForm } from "@/components/features/feature-form";
import { FeatureFilters } from "@/components/features/feature-filters";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { FeatureFilters as Filters } from "@/lib/api/features";

export function InboxPage() {
  const [isFeatureFormOpen, setIsFeatureFormOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    assignee: "me", // Default to current user
  });

  const updateFilters = (newFilters: Filters) => {
    // Keep assignee: "me" for inbox unless explicitly cleared via assigneeId
    setFilters({
      ...newFilters,
      assignee: newFilters.assigneeId ? undefined : "me",
    });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-6 border-b">
        <div>
          <h1 className="text-2xl font-semibold">Inbox</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Features assigned to you
          </p>
        </div>
        <Button onClick={() => setIsFeatureFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Feature
        </Button>
      </div>

      <FeatureFilters filters={filters} onChange={updateFilters} />

      <div className="flex-1 overflow-auto">
        <FeatureList filters={filters} />
      </div>

      <FeatureForm
        open={isFeatureFormOpen}
        onOpenChange={setIsFeatureFormOpen}
      />
    </div>
  );
}
