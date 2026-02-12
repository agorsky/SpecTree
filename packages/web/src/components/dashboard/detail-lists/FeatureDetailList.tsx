import { Badge } from '@/components/ui/badge';
import type { FeatureDetail } from '@/lib/api/user-activity-details';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';

interface FeatureDetailListProps {
  items: FeatureDetail[];
}

/**
 * FeatureDetailList - Renders a list of features with metadata
 * 
 * Shows:
 * - Feature identifier badge
 * - Feature title
 * - Epic name
 * - Status with color indicator
 * - Assignee name
 * - Creation time (relative)
 */
export function FeatureDetailList({ items }: FeatureDetailListProps) {
  return (
    <ul className="space-y-0" role="list">
      {items.map((item) => (
        <li key={item.id}>
          <FeatureDetailItem item={item} />
        </li>
      ))}
    </ul>
  );
}

function FeatureDetailItem({ item }: { item: FeatureDetail }) {
  const ariaLabel = `Feature ${item.identifier}: ${item.title}. Epic: ${item.epicName}. ${item.statusName ? `Status: ${item.statusName}.` : ''} ${item.assigneeName ? `Assigned to ${item.assigneeName}.` : ''} Created ${formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}`;
  
  return (
    <Link
      to={`/features/${item.identifier}`}
      className="block border-b py-3 px-3 sm:px-4 hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      aria-label={ariaLabel}
    >
      <div className="space-y-2">
        <div className="flex items-start sm:items-center gap-2 flex-col sm:flex-row">
          <Badge
            className="text-xs font-mono bg-blue-100 text-blue-700 px-1.5 rounded border-0 flex-shrink-0"
            aria-hidden="true"
          >
            {item.identifier}
          </Badge>
          <span className="font-medium text-sm sm:text-base line-clamp-2 sm:line-clamp-1 sm:truncate">{item.title}</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground flex-wrap" aria-hidden="true">
          <span className="truncate max-w-[120px] sm:max-w-none">{item.epicName}</span>
          <span className="hidden sm:inline">•</span>
          {item.statusColor && (
            <>
              <div className="flex items-center gap-1">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.statusColor }}
                />
                <span className="whitespace-nowrap">{item.statusName}</span>
              </div>
              <span className="hidden sm:inline">•</span>
            </>
          )}
          {item.assigneeName && (
            <>
              <span className="truncate max-w-[100px] sm:max-w-none">{item.assigneeName}</span>
              <span className="hidden sm:inline">•</span>
            </>
          )}
          <span className="whitespace-nowrap">{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</span>
        </div>
      </div>
    </Link>
  );
}
