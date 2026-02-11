import { useState, useMemo } from "react";
import { useEpics } from "@/hooks/queries/use-epics";
import { Button } from "@/components/ui/button";
import { EpicForm } from "@/components/epics/epic-form";
import { EpicCard } from "@/components/epics/epic-card";
import { TeamSection } from "@/components/epics/team-section";
import { Plus, Filter, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Epic } from "@/lib/api/types";

/**
 * Groups epics by team ID (stable identifier) and sorts groups alphabetically by team name.
 * Epics without a team are grouped under a "no-team" key.
 */
function groupEpicsByTeam(epics: Epic[]): Map<string, { team: Epic['team']; epics: Epic[] }> {
  const grouped = new Map<string, { team: Epic['team']; epics: Epic[] }>();

  epics.forEach((epic) => {
    const teamKey = epic.team?.id ?? "no-team";
    if (!grouped.has(teamKey)) {
      grouped.set(teamKey, { team: epic.team, epics: [] });
    }
    grouped.get(teamKey)!.epics.push(epic);
  });

  return new Map(
    [...grouped.entries()].sort((a, b) => {
      const aName = a[1].team?.name ?? "No Team";
      const bName = b[1].team?.name ?? "No Team";
      return aName.localeCompare(bName);
    })
  );
}

export function EpicsPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useEpics({ includeArchived: showArchived });

  const epics = data?.pages.flatMap((page) => page.data) ?? [];
  
  // Group epics by team with memoization for performance
  const groupedEpics = useMemo(() => groupEpicsByTeam(epics), [epics]);

  return (
    <div className="p-4 max-w-screen-2xl mx-auto sm:p-6">
      <div className="flex items-center justify-between mb-6 gap-3 sm:mb-8">
        <h1 className="text-2xl font-bold sm:text-3xl">Epics</h1>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">{showArchived ? "All epics" : "Active"}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowArchived(false)}>
                <Check className={`h-4 w-4 mr-2 ${!showArchived ? "opacity-100" : "opacity-0"}`} />
                Active only
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowArchived(true)}>
                <Check className={`h-4 w-4 mr-2 ${showArchived ? "opacity-100" : "opacity-0"}`} />
                Include archived
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">New Epic</span>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-lg bg-muted"
            />
          ))}
        </div>
      ) : epics.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            {showArchived ? "No epics found" : "No epics yet"}
          </p>
          {!showArchived && (
            <Button onClick={() => setIsFormOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create your first epic
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-6 sm:space-y-8">
            {Array.from(groupedEpics.entries()).map(([teamKey, { team, epics: teamEpics }]) => (
              <TeamSection 
                key={teamKey} 
                teamName={team?.name ?? "No Team"} 
                epicCount={teamEpics.length}
              >
                {teamEpics.map((epic) => (
                  <EpicCard key={epic.id} epic={epic} />
                ))}
              </TeamSection>
            ))}
          </div>
          {hasNextPage && (
            <div className="mt-6 text-center sm:mt-8">
              <Button
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? "Loading..." : "Load more"}
              </Button>
            </div>
          )}
        </>
      )}

      <EpicForm open={isFormOpen} onOpenChange={setIsFormOpen} />
    </div>
  );
}
