import { useState } from 'react';
import { useTasks } from '@/hooks/queries/use-tasks';
import { TaskListItem } from './task-list-item';
import { TaskForm } from './task-form';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface TaskListProps {
  featureId: string;
  teamId?: string | undefined;
}

export function TaskList({ featureId, teamId }: TaskListProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useTasks({ featureId });

  const tasks = data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Tasks ({tasks.length})</h3>
        <Button variant="ghost" size="sm" onClick={() => setIsFormOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add task
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-muted-foreground text-center py-8 border rounded-lg border-dashed">
          No tasks yet. Create one to get started.
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskListItem key={task.id} task={task} teamId={teamId} />
          ))}
          {hasNextPage && (
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? 'Loading...' : 'Load more'}
            </Button>
          )}
        </div>
      )}

      <TaskForm
        featureId={featureId}
        teamId={teamId}
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
      />
    </div>
  );
}
