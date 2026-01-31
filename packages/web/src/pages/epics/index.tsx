import { useState } from "react";
import { useEpics } from "@/hooks/queries/use-epics";
import { Button } from "@/components/ui/button";
import { EpicForm } from "@/components/epics/epic-form";
import { EpicCard } from "@/components/epics/epic-card";
import { Plus, Filter, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function EpicsPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useEpics({ includeArchived: showArchived });

  const epics = data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Epics</h1>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                {showArchived ? "All epics" : "Active"}
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
            <Plus className="h-4 w-4 mr-2" />
            New Epic
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {epics.map((epic) => (
              <EpicCard key={epic.id} epic={epic} />
            ))}
          </div>
          {hasNextPage && (
            <div className="mt-6 text-center">
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
