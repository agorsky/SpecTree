import { Badge } from '@/components/ui/badge';
import type { SessionDetail } from '@/lib/api/user-activity-details';
import { formatDistanceToNow } from 'date-fns';

interface SessionDetailListProps {
  items: SessionDetail[];
}

/**
 * SessionDetailList - Renders a list of AI sessions with metadata
 * 
 * Shows:
 * - Epic name
 * - Session duration (calculated or "In progress")
 * - Session summary (if available)
 * - Status badge (colored by status)
 * - Start time (relative)
 */
export function SessionDetailList({ items }: SessionDetailListProps) {
  return (
    <ul className="space-y-0" role="list">
      {items.map((item) => (
        <li key={item.id}>
          <SessionDetailItem item={item} />
        </li>
      ))}
    </ul>
  );
}

function SessionDetailItem({ item }: { item: SessionDetail }) {
  const getDuration = () => {
    if (!item.endedAt) {
      return 'In progress';
    }
    const start = new Date(item.startedAt);
    const end = new Date(item.endedAt);
    const durationMs = end.getTime() - start.getTime();
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${String(hours)}h ${String(minutes)}m`;
    }
    return `${String(minutes)}m`;
  };

  const getStatusBadgeClass = () => {
    switch (item.status) {
      case 'active':
        return 'bg-green-100 text-green-700';
      case 'completed':
        return 'bg-blue-100 text-blue-700';
      case 'abandoned':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const duration = getDuration();
  const ariaLabel = `AI Session for ${item.epicName}. Duration: ${duration}. Status: ${item.status}. Started ${formatDistanceToNow(new Date(item.startedAt), { addSuffix: true })}${item.summary ? `. ${item.summary}` : ''}`;

  return (
    <article className="border-b py-3 px-3 sm:px-4" aria-label={ariaLabel}>
      <div className="space-y-2">
        <div className="flex items-start sm:items-center justify-between gap-2">
          <span className="font-medium text-sm sm:text-base line-clamp-2 flex-1">{item.epicName}</span>
          <span className="text-xs sm:text-sm text-muted-foreground flex-shrink-0 whitespace-nowrap" aria-hidden="true">{duration}</span>
        </div>
        {item.summary && (
          <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2" aria-hidden="true">{item.summary}</p>
        )}
        <div className="flex items-center gap-1.5 sm:gap-2 text-xs flex-wrap" aria-hidden="true">
          <Badge className={`text-xs border-0 flex-shrink-0 ${getStatusBadgeClass()}`}>
            {item.status}
          </Badge>
          <span className="text-muted-foreground whitespace-nowrap">
            {formatDistanceToNow(new Date(item.startedAt), { addSuffix: true })}
          </span>
        </div>
      </div>
    </article>
  );
}
