import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth-store';
import {
  useEpicRequest,
  useReactToEpicRequest,
  useRemoveReactionFromEpicRequest,
  useEpicRequestComments,
  useCreateEpicRequestComment,
  useUpdateEpicRequestComment,
  useDeleteEpicRequestComment,
  useApproveEpicRequest,
  useRejectEpicRequest,
  useDeleteEpicRequest,
  useUpdateEpicRequest,
} from '@/hooks/queries/use-epic-requests';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { MarkdownRenderer } from '@/components/common/markdown-renderer';
import { ArrowLeft, ThumbsUp, Flame, ThumbsDown, Edit, Trash2, Send, Check, CheckCircle, X, Copy, Terminal } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import type { EpicRequestStatus, ReactionType, EpicRequestComment } from '@/lib/api/epic-requests';

// Status badge colors based on status
const statusColors: Record<EpicRequestStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  converted: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
};

export function EpicRequestDetailPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const { data: request, isLoading } = useEpicRequest(requestId ?? '');
  const reactMutation = useReactToEpicRequest();
  const removeReactionMutation = useRemoveReactionFromEpicRequest();

  // Comments
  const {
    data: commentsData,
    isLoading: commentsLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useEpicRequestComments(requestId ?? '');

  const createCommentMutation = useCreateEpicRequestComment();
  const updateCommentMutation = useUpdateEpicRequestComment();
  const deleteCommentMutation = useDeleteEpicRequestComment();

  // Admin actions
  const approveMutation = useApproveEpicRequest();
  const rejectMutation = useRejectEpicRequest();
  const deleteRequestMutation = useDeleteEpicRequest();
  const updateRequestMutation = useUpdateEpicRequest();

  // Comment form state
  const [newCommentContent, setNewCommentContent] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCopyCommand = useCallback(async (command: string) => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = command;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);

      try {
        textArea.select();
        // eslint-disable-next-line deprecation/deprecation
        const successful = document.execCommand('copy');
        if (successful) {
          setCopied(true);
          setTimeout(() => {
            setCopied(false);
          }, 2000);
        }
      } catch {
        // Swallow copy fallback errors to avoid unhandled promise rejections
      } finally {
        document.body.removeChild(textArea);
      }
    }
  }, []);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-6 w-full animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Epic request not found</p>
        <Button
          variant="ghost"
          onClick={() => { void navigate('/epic-requests'); }}
          className="mt-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to epic requests
        </Button>
      </div>
    );
  }

  // Get reaction counts
  const getReactionCount = (type: ReactionType): number => {
    const reaction = request.reactionCounts?.find((r) => r.reactionType === type);
    return reaction?.count ?? 0;
  };

  const likeCount = getReactionCount('like');
  const fireCount = getReactionCount('fire');
  const dislikeCount = getReactionCount('dislike');

  // Check if user has reacted and what type
  const userReaction = request.userReaction as ReactionType | null;

  // Check if current user is the creator (will be used in next tasks)
  // const isCreator = user?.id === request.requestedById;

  // Handle reaction toggle
  const handleReaction = async (type: ReactionType) => {
    if (!requestId) return;

    // If clicking the same reaction, remove it
    if (userReaction === type) {
      await removeReactionMutation.mutateAsync(requestId);
    } else {
      // Otherwise, add/change reaction
      await reactMutation.mutateAsync({
        id: requestId,
        input: { reactionType: type },
      });
    }
  };

  // Flatten all comments from pages
  const allComments = commentsData?.pages.flatMap((page) => page.data) ?? [];

  // Handle create comment
  const handleCreateComment = async () => {
    if (!requestId || !newCommentContent.trim()) return;

    await createCommentMutation.mutateAsync({
      id: requestId,
      input: { content: newCommentContent.trim() },
    });
    setNewCommentContent('');
  };

  // Handle edit comment
  const handleStartEdit = (comment: EpicRequestComment) => {
    setEditingCommentId(comment.id);
    setEditingContent(comment.content);
  };

  const handleSaveEdit = async (commentId: string) => {
    if (!requestId || !editingContent.trim()) return;

    await updateCommentMutation.mutateAsync({
      epicRequestId: requestId,
      commentId,
      input: { content: editingContent.trim() },
    });
    setEditingCommentId(null);
    setEditingContent('');
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditingContent('');
  };

  // Handle delete comment
  const handleDeleteComment = async (commentId: string) => {
    if (!requestId) return;

    if (
      window.confirm('Are you sure you want to delete this comment? This action cannot be undone.')
    ) {
      await deleteCommentMutation.mutateAsync({
        epicRequestId: requestId,
        commentId,
      });
    }
  };

  // Admin action handlers
  const handleApprove = async () => {
    if (!requestId) return;
    await approveMutation.mutateAsync(requestId);
  };

  const handleReject = async () => {
    if (!requestId) return;
    await rejectMutation.mutateAsync(requestId);
  };

  const handleDeleteRequest = async () => {
    if (!requestId) return;
    if (
      window.confirm(
        'Are you sure you want to delete this epic request? This action cannot be undone.'
      )
    ) {
      await deleteRequestMutation.mutateAsync(requestId);
      void navigate('/epic-requests');
    }
  };

  const handleMarkImplemented = async () => {
    if (!requestId) return;
    await updateRequestMutation.mutateAsync({
      id: requestId,
      input: { status: 'converted' },
    });
  };

  const handleEdit = () => {
    // Navigate to edit page (not yet implemented, placeholder)
    void navigate(`/epic-requests/${requestId ?? ''}/edit`);
  };

  const plannerCommand = `@planner --from-request "${request.title}"`;

  // Determine permissions
  const isAdmin = user?.isGlobalAdmin ?? false;
  const isCreator = user?.id === request.requestedById;
  const canEdit = isCreator && request.status !== 'approved' && request.status !== 'converted';
  const canDelete = isAdmin;
  const canApproveReject = isAdmin;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b bg-background">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => { void navigate('/epic-requests'); }}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold truncate">{request.title}</h1>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Edit Button - visible for creator when status != approved/converted */}
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => { handleEdit(); }}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}

          {/* Approve/Reject Buttons - visible for admins */}
          {canApproveReject && request.status === 'pending' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { void handleApprove(); }}
                disabled={approveMutation.isPending}
                className="text-green-600 hover:text-green-700"
              >
                <Check className="h-4 w-4 mr-2" />
                Approve
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { void handleReject(); }}
                disabled={rejectMutation.isPending}
                className="text-red-600 hover:text-red-700"
              >
                <X className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </>
          )}

          {/* Mark Implemented Button - visible for admins when approved */}
          {isAdmin && request.status === 'approved' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { void handleMarkImplemented(); }}
              disabled={updateRequestMutation.isPending}
              className="text-blue-600 hover:text-blue-700"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Mark Implemented
            </Button>
          )}

          {/* Delete Button - visible for admins only */}
          {canDelete && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { void handleDeleteRequest(); }}
              disabled={deleteRequestMutation.isPending}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
        </div>

        <Badge
          className={cn('text-xs font-medium', statusColors[request.status])}
        >
          {request.status}
        </Badge>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6 space-y-6">
          {/* Metadata */}
          <div className="text-sm text-muted-foreground">
            Requested by {request.requestedBy?.name ?? 'Unknown'} •{' '}
            {formatDistanceToNow(new Date(request.createdAt), {
              addSuffix: true,
            })}
          </div>

          {/* Planner Command - only shown for approved requests */}
          {request.status === 'approved' && (
          <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Terminal className="h-4 w-4" />
              <span>Create Epic from this Request</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-background px-3 py-2 text-sm font-mono border select-all">
                {plannerCommand}
              </code>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => { void handleCopyCommand(plannerCommand); }}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          )}

          {/* Description */}
          {request.description && (
            <div className="prose dark:prose-invert max-w-none">
              <MarkdownRenderer content={request.description} />
            </div>
          )}

          {/* Structured Description */}
          {request.structuredDesc && (
            <div className="space-y-4 border-t pt-6">
              {request.structuredDesc.problemStatement && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Problem Statement</h3>
                  <p className="text-sm text-muted-foreground">
                    {request.structuredDesc.problemStatement}
                  </p>
                </div>
              )}

              {request.structuredDesc.proposedSolution && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Proposed Solution</h3>
                  <p className="text-sm text-muted-foreground">
                    {request.structuredDesc.proposedSolution}
                  </p>
                </div>
              )}

              {request.structuredDesc.impactAssessment && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Impact Assessment</h3>
                  <p className="text-sm text-muted-foreground">
                    {request.structuredDesc.impactAssessment}
                  </p>
                </div>
              )}

              {request.structuredDesc.targetAudience && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Target Audience</h3>
                  <p className="text-sm text-muted-foreground">
                    {request.structuredDesc.targetAudience}
                  </p>
                </div>
              )}

              {request.structuredDesc.successMetrics && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Success Metrics</h3>
                  <p className="text-sm text-muted-foreground">
                    {request.structuredDesc.successMetrics}
                  </p>
                </div>
              )}

              {request.structuredDesc.alternatives && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Alternatives</h3>
                  <p className="text-sm text-muted-foreground">
                    {request.structuredDesc.alternatives}
                  </p>
                </div>
              )}

              {request.structuredDesc.dependencies && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Dependencies</h3>
                  <p className="text-sm text-muted-foreground">
                    {request.structuredDesc.dependencies}
                  </p>
                </div>
              )}

              {request.structuredDesc.estimatedEffort && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Estimated Effort</h3>
                  <p className="text-sm text-muted-foreground">
                    {request.structuredDesc.estimatedEffort}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Reactions */}
          <div className="border-t pt-6">
            <h3 className="text-sm font-semibold mb-3">Reactions</h3>
            <div className="flex items-center gap-2">
              {/* Like Button */}
              <Button
                variant={userReaction === 'like' ? 'default' : 'outline'}
                size="sm"
                onClick={() => { void handleReaction('like'); }}
                disabled={reactMutation.isPending || removeReactionMutation.isPending}
                className={cn(
                  'gap-2',
                  userReaction === 'like' && 'bg-blue-500 hover:bg-blue-600'
                )}
              >
                <ThumbsUp className="h-4 w-4" />
                <span>Like</span>
                {likeCount > 0 && (
                  <span className="ml-1 font-semibold">{likeCount}</span>
                )}
              </Button>

              {/* Fire Button */}
              <Button
                variant={userReaction === 'fire' ? 'default' : 'outline'}
                size="sm"
                onClick={() => { void handleReaction('fire'); }}
                disabled={reactMutation.isPending || removeReactionMutation.isPending}
                className={cn(
                  'gap-2',
                  userReaction === 'fire' && 'bg-orange-500 hover:bg-orange-600'
                )}
              >
                <Flame className="h-4 w-4" />
                <span>Fire</span>
                {fireCount > 0 && (
                  <span className="ml-1 font-semibold">{fireCount}</span>
                )}
              </Button>

              {/* Dislike Button */}
              <Button
                variant={userReaction === 'dislike' ? 'default' : 'outline'}
                size="sm"
                onClick={() => { void handleReaction('dislike'); }}
                disabled={reactMutation.isPending || removeReactionMutation.isPending}
                className={cn(
                  'gap-2',
                  userReaction === 'dislike' && 'bg-red-500 hover:bg-red-600'
                )}
              >
                <ThumbsDown className="h-4 w-4" />
                <span>Dislike</span>
                {dislikeCount > 0 && (
                  <span className="ml-1 font-semibold">{dislikeCount}</span>
                )}
              </Button>
            </div>
          </div>

          {/* Comments Section */}
          <div className="border-t pt-6">
            <h3 className="text-sm font-semibold mb-4">
              Comments ({allComments.length})
            </h3>

            {/* Add Comment Form */}
            <div className="mb-6 space-y-2">
              <Textarea
                placeholder="Add a comment..."
                value={newCommentContent}
                onChange={(e) => { setNewCommentContent(e.target.value); }}
                className="min-h-[80px]"
              />
              <div className="flex justify-end">
                <Button
                  onClick={() => { void handleCreateComment(); }}
                  disabled={
                    !newCommentContent.trim() || createCommentMutation.isPending
                  }
                  size="sm"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Post Comment
                </Button>
              </div>
            </div>

            {/* Comments List */}
            {commentsLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }, (_, i) => (
                  <div key={i} className="animate-pulse space-y-2">
                    <div className="h-4 w-32 bg-muted rounded" />
                    <div className="h-16 w-full bg-muted rounded" />
                  </div>
                ))}
              </div>
            ) : allComments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No comments yet. Be the first to comment!
              </p>
            ) : (
              <div className="space-y-4">
                {allComments.map((comment) => {
                  const isAuthor = user?.id === comment.authorId;
                  const isAdmin = user?.isGlobalAdmin;
                  const isEditing = editingCommentId === comment.id;

                  return (
                    <div
                      key={comment.id}
                      className="border rounded-lg p-4 space-y-2"
                    >
                      {/* Comment Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium">
                            {comment.author.name}
                          </span>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-muted-foreground">
                            {formatDistanceToNow(new Date(comment.createdAt), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                        {(isAuthor || isAdmin) && !isEditing && (
                          <div className="flex items-center gap-1">
                            {isAuthor && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => { handleStartEdit(comment); }}
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {(isAuthor || isAdmin) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => { void handleDeleteComment(comment.id); }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Comment Content */}
                      {isEditing ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editingContent}
                            onChange={(e) => { setEditingContent(e.target.value); }}
                            className="min-h-[80px]"
                          />
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleCancelEdit}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => { void handleSaveEdit(comment.id); }}
                              disabled={
                                !editingContent.trim() ||
                                updateCommentMutation.isPending
                              }
                            >
                              Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">
                          {comment.content}
                        </p>
                      )}
                    </div>
                  );
                })}

                {/* Load More Comments */}
                {hasNextPage && (
                  <div className="flex justify-center pt-4">
                    <Button
                      variant="outline"
                      onClick={() => { void fetchNextPage(); }}
                      disabled={isFetchingNextPage}
                    >
                      {isFetchingNextPage ? 'Loading...' : 'Load More Comments'}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
