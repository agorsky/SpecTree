import { useState } from 'react';
import type { Task } from '@/lib/api/types';
import { useUpdateTask, useDeleteTask } from '@/hooks/queries/use-tasks';
import { useStatuses } from '@/hooks/queries/use-statuses';
import { StatusSelect } from '@/components/common/status-select';
import { AssigneeSelect } from '@/components/common/assignee-select';
import { MarkdownEditor } from '@/components/common/markdown-editor';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, MoreHorizontal, ChevronDown, ChevronUp } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface TaskListItemProps {
  task: Task;
  teamId?: string | undefined;
}

export function TaskListItem({ task, teamId }: TaskListItemProps) {
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const { data: statuses } = useStatuses(teamId);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const isCompleted = task.status?.category === 'completed';

  const handleToggleComplete = (checked: boolean) => {
    if (!statuses || statuses.length === 0) return;

    if (checked) {
      // Find a completed status
      const completedStatus = statuses.find((s) => s.category === 'completed');
      if (completedStatus) {
        updateTask.mutate({ id: task.id, statusId: completedStatus.id });
      }
    } else {
      // Find an unstarted/backlog status
      const unstartedStatus = statuses.find(
        (s) => s.category === 'unstarted' || s.category === 'backlog'
      );
      if (unstartedStatus) {
        updateTask.mutate({ id: task.id, statusId: unstartedStatus.id });
      }
    }
  };

  const handleStatusChange = (statusId: string | undefined) => {
    if (!statusId) return;
    updateTask.mutate({ id: task.id, statusId });
  };

  const handleAssigneeChange = (assigneeId: string | undefined) => {
    const updateData: Parameters<typeof updateTask.mutate>[0] = { id: task.id };
    if (assigneeId) {
      updateData.assigneeId = assigneeId;
    }
    updateTask.mutate(updateData);
  };

  const handleDescriptionChange = (description: string) => {
    updateTask.mutate({ id: task.id, description: description || undefined });
  };

  const handleDelete = () => {
    deleteTask.mutate(task.id);
    setShowDeleteDialog(false);
  };

  return (
    <>
      <div className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
        <Checkbox
          checked={isCompleted}
          onCheckedChange={handleToggleComplete}
          className="mt-1"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-mono flex-shrink-0">
              {task.identifier}
            </span>
            <span
              className={`font-medium ${isCompleted ? 'line-through text-muted-foreground' : ''}`}
            >
              {task.title}
            </span>
          </div>
          {task.description && !isExpanded && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {task.description}
            </p>
          )}

          {isExpanded && (
            <div className="mt-3 space-y-4">
              <div className="flex flex-wrap gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Status</label>
                  <StatusSelect
                    teamId={teamId}
                    value={task.statusId}
                    onChange={handleStatusChange}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Assignee</label>
                  <AssigneeSelect
                    value={task.assigneeId}
                    onChange={handleAssigneeChange}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Description</label>
                <MarkdownEditor
                  value={task.description ?? ''}
                  onChange={handleDescriptionChange}
                  placeholder="Add a description..."
                  minHeight="80px"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsExpanded(!isExpanded)}>
                {isExpanded ? 'Collapse' : 'Expand'}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setShowDeleteDialog(true)}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Task</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{task.title}"? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteTask.isPending}
            >
              {deleteTask.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
