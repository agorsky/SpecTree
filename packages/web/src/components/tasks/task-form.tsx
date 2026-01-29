import { useState } from 'react';
import { useCreateTask } from '@/hooks/queries/use-tasks';
import { useStatuses } from '@/hooks/queries/use-statuses';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { StatusSelect } from '@/components/common/status-select';
import { AssigneeSelect } from '@/components/common/assignee-select';

interface TaskFormProps {
  featureId: string;
  teamId?: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskForm({ featureId, teamId, open, onOpenChange }: TaskFormProps) {
  const createTask = useCreateTask();
  const { data: statuses } = useStatuses(teamId);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [statusId, setStatusId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');

  // Set default status to first "unstarted" or "backlog" status
  const defaultStatus = statuses?.find(
    (s) => s.category === 'unstarted' || s.category === 'backlog'
  );

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setStatusId('');
    setAssigneeId('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) return;

    await createTask.mutateAsync({
      title: title.trim(),
      description: description.trim() || undefined,
      featureId,
      statusId: statusId || defaultStatus?.id,
      assigneeId: assigneeId || undefined,
    });

    resetForm();
    onOpenChange(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <StatusSelect
                teamId={teamId}
                value={statusId || defaultStatus?.id}
                onChange={(id) => id && setStatusId(id)}
              />
            </div>

            <div className="space-y-2">
              <Label>Assignee</Label>
              <AssigneeSelect
                value={assigneeId}
                onChange={(id) => setAssigneeId(id ?? '')}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createTask.isPending || !title.trim()}>
              {createTask.isPending ? 'Creating...' : 'Create Task'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
