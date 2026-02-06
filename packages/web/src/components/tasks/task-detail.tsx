import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTask, useUpdateTask, useDeleteTask } from "@/hooks/queries/use-tasks";
import { useStatuses } from "@/hooks/queries/use-statuses";
import { useUsers } from "@/hooks/queries/use-users";
import { MarkdownEditor } from "@/components/common/markdown-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Trash2, Check, X, Circle, CheckCircle2, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { DetailTabs, TabsContent } from "../detail-tabs/detail-tabs";
import { ActivityPanel } from "../activity/activity-panel";
import DecisionsPanel from "../decisions/decisions-panel";
import CodeContextPanel from "../code-context/code-context-panel";

const StatusIcon = ({ category, className }: { category: string | undefined; className?: string }) => {
  if (category === "completed") {
    return <CheckCircle2 className={cn("h-4 w-4 text-green-500", className)} />;
  }
  if (category === "canceled") {
    return <Circle className={cn("h-4 w-4 text-red-500", className)} />;
  }
  if (category === "started") {
    return <Circle className={cn("h-4 w-4 text-yellow-500 fill-yellow-500/30", className)} />;
  }
  return <Circle className={cn("h-4 w-4 text-muted-foreground", className)} />;
};

export function TaskDetail() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { data: task, isLoading } = useTask(taskId ?? "");
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const teamId = task?.feature?.epic?.teamId;
  const { data: statuses } = useStatuses(teamId);
  const { data: users } = useUsers();

  const [activeTab, setActiveTab] = useState("description");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const currentStatus = statuses?.find((s) => s.id === task?.statusId);
  const currentAssignee = users?.find((u) => u.id === task?.assigneeId);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-6 w-full animate-pulse rounded bg-muted" />
        <div className="h-20 w-full animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Task not found</p>
        <Button variant="ghost" onClick={() => navigate(-1)} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go back
        </Button>
      </div>
    );
  }

  const handleTitleSave = async () => {
    if (editedTitle.trim() && editedTitle !== task.title) {
      await updateTask.mutateAsync({
        id: task.id,
        title: editedTitle.trim(),
      });
    }
    setIsEditingTitle(false);
  };

  const handleDescriptionChange = async (description: string) => {
    if (description !== (task.description ?? "")) {
      await updateTask.mutateAsync({
        id: task.id,
        description: description || undefined,
      });
    }
  };

  const handleStatusChange = async (statusId: string | undefined) => {
    if (!statusId) return;
    await updateTask.mutateAsync({
      id: task.id,
      statusId,
    });
  };

  const handleAssigneeChange = async (assigneeId: string | undefined) => {
    const updateData: Parameters<typeof updateTask.mutateAsync>[0] = {
      id: task.id,
    };
    if (assigneeId) {
      updateData.assigneeId = assigneeId;
    }
    await updateTask.mutateAsync(updateData);
  };

  const handleDelete = async () => {
    await deleteTask.mutateAsync(task.id);
    navigate(-1);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          {isEditingTitle ? (
            <div className="flex items-center gap-2">
              <Input
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="text-xl font-semibold"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleTitleSave();
                  if (e.key === "Escape") setIsEditingTitle(false);
                }}
              />
              <Button size="icon" variant="ghost" onClick={handleTitleSave}>
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setIsEditingTitle(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground font-mono">
                {task.identifier}
              </span>
              <h1
                className="text-xl font-semibold cursor-pointer hover:bg-muted/50 px-2 py-1 rounded -mx-2"
                onClick={() => {
                  setEditedTitle(task.title);
                  setIsEditingTitle(true);
                }}
              >
                {task.title}
              </h1>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive"
          onClick={() => setShowDeleteDialog(true)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Content with sidebar layout */}
      <div className="flex-1 overflow-auto flex">
        {/* Main content */}
        <div className="flex-1 p-6 overflow-auto">
          <DetailTabs
            tabs={[
              { id: "description", label: "Description" },
              { id: "activity", label: "Activity" },
              { id: "decisions", label: "Decisions" },
              { id: "code", label: "Code" },
            ]}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          >
            <TabsContent value="description">
              <div className="space-y-6">
                <MarkdownEditor
                  value={task.description ?? ""}
                  onChange={(value) => void handleDescriptionChange(value)}
                  placeholder="Add a description..."
                />
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Created: {new Date(task.createdAt).toLocaleDateString()}</p>
                  <p>Updated: {new Date(task.updatedAt).toLocaleDateString()}</p>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="activity">
              <ActivityPanel taskId={task.id} />
            </TabsContent>
            <TabsContent value="decisions">
              <DecisionsPanel taskId={task.id} />
            </TabsContent>
            <TabsContent value="code">
              <CodeContextPanel taskId={task.id} />
            </TabsContent>
          </DetailTabs>
        </div>

        {/* Properties sidebar */}
        <div className="w-56 border-l p-4 space-y-1 shrink-0">
          <div className="text-xs font-medium text-muted-foreground mb-3">Properties</div>

          {/* Status property */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-muted/50 transition-colors text-left">
                <StatusIcon category={currentStatus?.category} />
                <span className={currentStatus ? "" : "text-muted-foreground"}>
                  {currentStatus?.name ?? "Set status"}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="bottom" align="start" className="w-48">
              {statuses?.map((status) => (
                <DropdownMenuItem
                  key={status.id}
                  onClick={() => handleStatusChange(status.id)}
                  className="flex items-center gap-2"
                >
                  <StatusIcon category={status.category} />
                  {status.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Assignee property */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-muted/50 transition-colors text-left">
                {currentAssignee ? (
                  <>
                    <Avatar className="h-4 w-4">
                      <AvatarFallback className="text-[9px]">
                        {currentAssignee.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span>{currentAssignee.name}</span>
                  </>
                ) : (
                  <>
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Assign</span>
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="bottom" align="start" className="w-48">
              <DropdownMenuItem
                onClick={() => handleAssigneeChange(undefined)}
                className="flex items-center gap-2 text-muted-foreground"
              >
                <User className="h-4 w-4" />
                Unassigned
              </DropdownMenuItem>
              {users?.map((user) => (
                <DropdownMenuItem
                  key={user.id}
                  onClick={() => handleAssigneeChange(user.id)}
                  className="flex items-center gap-2"
                >
                  <Avatar className="h-4 w-4">
                    <AvatarFallback className="text-[9px]">
                      {user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {user.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Parent feature (read-only) */}
          {task.feature && (
            <div className="pt-4 mt-4 border-t">
              <div className="text-xs font-medium text-muted-foreground mb-2">Feature</div>
              <button
                className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-muted/50 rounded-md transition-colors w-full text-left"
                onClick={() => navigate(`/features/${task.feature!.id}`)}
              >
                <div className="h-3 w-3 rounded-sm bg-primary/20" />
                <span className="truncate">{task.feature.title}</span>
              </button>
            </div>
          )}

          {/* Epic info (read-only) */}
          {task.feature?.epic && (
            <div className="pt-2">
              <div className="text-xs font-medium text-muted-foreground mb-2">Epic</div>
              <div className="flex items-center gap-2 px-2 py-1.5 text-sm">
                <div className="h-3 w-3 rounded-sm bg-primary/20" />
                <span className="truncate">{task.feature.epic.name}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Task</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{task.title}"? This action
              cannot be undone.
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
              {deleteTask.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
