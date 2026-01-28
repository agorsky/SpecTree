import { StatusSelect } from "@/components/common/status-select";
import { AssigneeSelect } from "@/components/common/assignee-select";
import { SearchInput } from "@/components/common/search-input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { FeatureFilters as Filters } from "@/lib/api/features";

interface FeatureFiltersProps {
  teamId?: string;
  filters: Filters;
  onChange: (filters: Filters) => void;
}

export function FeatureFilters({
  teamId,
  filters,
  onChange,
}: FeatureFiltersProps) {
  const hasActiveFilters = filters.statusId || filters.assigneeId;

  const updateFilter = <K extends keyof Filters>(
    key: K,
    value: Filters[K] | undefined
  ) => {
    onChange({ ...filters, [key]: value || undefined });
  };

  const clearFilters = () => {
    onChange({});
  };

  return (
    <div className="flex items-center gap-4 p-4 border-b">
      <SearchInput
        value={filters.query || ""}
        onChange={(value) => updateFilter("query", value)}
        placeholder="Search features..."
        className="w-64"
      />

      <div className="flex items-center gap-2">
        <StatusSelect
          teamId={teamId}
          value={filters.statusId}
          onChange={(value) => updateFilter("statusId", value)}
          placeholder="All statuses"
          allowClear
          className="w-40"
        />

        <AssigneeSelect
          value={filters.assigneeId}
          onChange={(value) => updateFilter("assigneeId", value)}
          placeholder="All assignees"
          allowClear
          className="w-40"
        />

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
