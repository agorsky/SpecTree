import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useEpic, useUpdateEpic, useDeleteEpic, useArchiveEpic, useUnarchiveEpic } from "@/hooks/queries/use-epics";
import { IssuesList } from "@/components/issues/issues-list";
import { FeatureForm } from "@/components/features/feature-form";
import { MarkdownRenderer } from "@/components/common/markdown-renderer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, Trash2, Check, X, MoreHorizontal, ChevronDown, ChevronRight, Archive, ArchiveRestore } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

export function EpicDetailPage() {
  const { epicId } = useParams<{ epicId: string }>();
  const navigate = useNavigate();
  const { data: epic, isLoading } = useEpic(epicId ?? "");
  const updateEpic = useUpdateEpic();
  const deleteEpic = useDeleteEpic();
  const archiveEpic = useArchiveEpic();
  const unarchiveEpic = useUnarchiveEpic();

  const [isFeatureFormOpen, setIsFeatureFormOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-6 w-full animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (!epic) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Epic not found</p>
        <Button variant="ghost" onClick={() => navigate("/epics")} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to epics
        </Button>
      </div>
    );
  }

  const handleNameSave = async () => {
    if (editedName.trim() && editedName !== epic.name) {
      await updateEpic.mutateAsync({
        id: epic.id,
        name: editedName.trim(),
      });
    }
    setIsEditingName(false);
  };

  const handleDelete = async () => {
    await deleteEpic.mutateAsync(epic.id);
    navigate("/epics");
  };

  const handleArchive = async () => {
    await archiveEpic.mutateAsync(epic.id);
    setShowArchiveDialog(false);
    navigate("/epics");
  };

  const handleUnarchive = async () => {
    await unarchiveEpic.mutateAsync(epic.id);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header - Clean top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-background">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/epics")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        
        <div className="flex-1 min-w-0">
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <Input
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="text-lg font-semibold h-8"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleNameSave();
                  if (e.key === "Escape") setIsEditingName(false);
                }}
              />
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleNameSave}>
                <Check className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setIsEditingName(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1
                className="text-lg font-semibold truncate cursor-pointer hover:text-muted-foreground transition-colors"
                onClick={() => {
                  if (!epic.isArchived) {
                    setEditedName(epic.name);
                    setIsEditingName(true);
                  }
                }}
              >
                {epic.name}
              </h1>
              {epic.isArchived && (
                <Badge variant="secondary" className="gap-1">
                  <Archive className="h-3 w-3" />
                  Archived
                </Badge>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {epic.isArchived ? (
            <Button size="sm" variant="outline" onClick={handleUnarchive} disabled={unarchiveEpic.isPending}>
              <ArchiveRestore className="h-4 w-4 mr-1.5" />
              {unarchiveEpic.isPending ? "Restoring..." : "Restore Epic"}
            </Button>
          ) : (
            <Button size="sm" onClick={() => setIsFeatureFormOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              New Feature
            </Button>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {epic.isArchived ? (
                <>
                  <DropdownMenuItem onClick={handleUnarchive}>
                    <ArchiveRestore className="h-4 w-4 mr-2" />
                    Restore Epic
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Permanently
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem onClick={() => setIsFeatureFormOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Feature
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowArchiveDialog(true)}>
                    <Archive className="h-4 w-4 mr-2" />
                    Archive Epic
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Epic
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Collapsible Description Section */}
      {epic.description && (
        <div className="border-b bg-muted/30">
          <button
            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
          >
            {isDescriptionExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <span>Epic Description</span>
          </button>
          {isDescriptionExpanded && (
            <div className="px-4 pb-4">
              <div className="bg-background rounded-lg border p-4">
                <MarkdownRenderer 
                  content={epic.description} 
                  className="text-sm"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Issues (Features + Tasks) */}
      <div className="flex-1 overflow-auto">
        {epicId && <IssuesList epicId={epicId} />}
      </div>

      {/* Feature form */}
      {epicId && (
        <FeatureForm
          open={isFeatureFormOpen}
          onOpenChange={setIsFeatureFormOpen}
          defaultEpicId={epicId}
        />
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Epic</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{epic.name}"? This will also
              delete all features in this epic. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteEpic.isPending}
            >
              {deleteEpic.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive confirmation dialog */}
      <Dialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Epic</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive "{epic.name}"? The epic and its features
              will be hidden from the default view but can be restored later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowArchiveDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleArchive}
              disabled={archiveEpic.isPending}
            >
              {archiveEpic.isPending ? "Archiving..." : "Archive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
