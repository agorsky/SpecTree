import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEpicRequests } from '@/hooks/queries/use-epic-requests';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, ThumbsUp, Flame, ThumbsDown, Plus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import type { EpicRequestStatus, EpicRequestWithReactionCounts } from '@/lib/api/epic-requests';

// Status badge colors based on status
const statusColors: Record<EpicRequestStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  converted: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
};

// Helper to get reaction count for a specific type
function getReactionCount(
  request: EpicRequestWithReactionCounts,
  type: 'like' | 'fire' | 'dislike'
): number {
  const reaction = request.reactionCounts.find((r) => r.reactionType === type);
  return reaction?.count ?? 0;
}

interface RequestCardProps {
  request: EpicRequestWithReactionCounts;
  onClick: () => void;
}

function RequestCard({ request, onClick }: RequestCardProps) {
  const likeCount = getReactionCount(request, 'like');
  const fireCount = getReactionCount(request, 'fire');
  const dislikeCount = getReactionCount(request, 'dislike');

  return (
    <Card
      className="p-4 hover:bg-accent/50 transition-colors cursor-pointer"
      onClick={onClick}
    >
      {/* Header with status */}
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-base font-semibold leading-tight flex-1 pr-2">
          {request.title}
        </h3>
        <Badge
          className={cn(
            'text-xs font-medium shrink-0',
            statusColors[request.status]
          )}
        >
          {request.status}
        </Badge>
      </div>

      {/* Author and time */}
      <div className="text-sm text-muted-foreground mb-3">
        <span>
          by {request.requestedBy?.name ?? 'Unknown'} •{' '}
          {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
        </span>
      </div>

      {/* Reaction counts */}
      <div className="flex items-center gap-3 text-sm">
        {likeCount > 0 && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <ThumbsUp className="h-4 w-4" />
            <span>{likeCount}</span>
          </div>
        )}
        {fireCount > 0 && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Flame className="h-4 w-4" />
            <span>{fireCount}</span>
          </div>
        )}
        {dislikeCount > 0 && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <ThumbsDown className="h-4 w-4" />
            <span>{dislikeCount}</span>
          </div>
        )}
        {likeCount === 0 && fireCount === 0 && dislikeCount === 0 && (
          <span className="text-muted-foreground">No reactions yet</span>
        )}
      </div>
    </Card>
  );
}

export function EpicRequestsPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Build filters for the query
  const filters = {
    ...(statusFilter !== 'all' && { status: statusFilter as EpicRequestStatus }),
  };

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useEpicRequests(filters);

  // Flatten pages and apply client-side search (since API doesn't have search yet)
  const allRequests = data?.pages.flatMap((page) => page.data) ?? [];
  const filteredRequests = searchQuery
    ? allRequests.filter((req) =>
        req.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allRequests;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Epic Requests</h1>
        <Button onClick={() => { void navigate('/epic-requests/new'); }}>
          <Plus className="h-4 w-4 mr-2" />
          New Request
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search requests..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); }}
            className="pl-9"
          />
        </div>

        {/* Status filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="converted">Converted</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Request list */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-lg bg-muted"
            />
          ))}
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            {searchQuery
              ? 'No requests match your search'
              : 'No epic requests yet'}
          </p>
          {!searchQuery && (
            <Button onClick={() => { void navigate('/epic-requests/new'); }}>
              <Plus className="h-4 w-4 mr-2" />
              Create your first request
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredRequests.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                onClick={() => { void navigate(`/epic-requests/${request.id}`); }}
              />
            ))}
          </div>

          {/* Load more button */}
          {hasNextPage && (
            <div className="mt-6 text-center">
              <Button
                variant="outline"
                onClick={() => { void fetchNextPage(); }}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? 'Loading...' : 'Load more'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
