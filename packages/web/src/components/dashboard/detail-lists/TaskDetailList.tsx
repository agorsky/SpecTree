import { Badge } from '@/components/ui/badge';
import type { TaskDetail } from '@/lib/api/user-activity-details';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';

interface TaskDetailListProps {
  items: TaskDetail[];
}

/**
 * TaskDetailList - Renders a list of tasks with metadata
 * 
 * Shows:
 * - Task identifier badge
 * - Task title
 * - Parent feature identifier
 * - Completion status
 * - Completion time (relative)
 */
export function TaskDetailList({ items }: TaskDetailListProps) {
  return (
    <ul className="space-y-0" role="list">
      {items.map((item) => (
        <li key={item.id}>
          <TaskDetailItem item={item} />
        </li>
      ))}
    </ul>
  );
}

function TaskDetailItem({ item }: { item: TaskDetail }) {
  const completedText = item.completedAt
    ? formatDistanceToNow(new Date(item.completedAt), { addSuffix: true })
    : 'Not completed';
  const ariaLabel = `Task ${item.identifier}: ${item.title}. Feature ${item.featureIdentifier}. Status: ${item.statusName}. ${item.completedAt ? `Completed ${completedText}` : completedText}`;
  
  return (
    <Link
      to={`/tasks/${item.identifier}`}
      className="block border-b py-3 px-3 sm:px-4 hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      aria-label={ariaLabel}
    >
      <div className="space-y-2">
        <div className="flex items-start sm:items-center gap-2 flex-col sm:flex-row">
          <Badge
            className="text-xs font-mono bg-green-100 text-green-700 px-1.5 rounded border-0 flex-shrink-0"
            aria-hidden="true"
          >
            {item.identifier}
          </Badge>
          <span className="font-medium text-sm sm:text-base line-clamp-2 sm:line-clamp-1 sm:truncate">{item.title}</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground flex-wrap" aria-hidden="true">
          <span className="hidden sm:inline">in</span>
          <Badge
            variant="outline"
            className="text-xs font-mono px-1.5"
          >
            {item.featureIdentifier}
          </Badge>
          <span className="hidden sm:inline">•</span>
          <div className="flex items-center gap-1">
            <span className="whitespace-nowrap">{item.statusName}</span>
          </div>
          <span className="hidden sm:inline">•</span>
          <span className="whitespace-nowrap">{completedText}</span>
        </div>
      </div>
    </Link>
  );
}
