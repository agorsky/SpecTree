import { Badge } from '@/components/ui/badge';
import type { DecisionDetail } from '@/lib/api/user-activity-details';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';

interface DecisionDetailListProps {
  items: DecisionDetail[];
}

/**
 * DecisionDetailList - Renders a list of decisions with metadata
 * 
 * Shows:
 * - Decision question
 * - Decision text
 * - Category badge
 * - Impact badge (colored by level)
 * - Epic name
 * - Creation time (relative)
 * - Links to feature if available
 */
export function DecisionDetailList({ items }: DecisionDetailListProps) {
  return (
    <ul className="space-y-0" role="list">
      {items.map((item) => (
        <li key={item.id}>
          <DecisionDetailItem item={item} />
        </li>
      ))}
    </ul>
  );
}

function DecisionDetailItem({ item }: { item: DecisionDetail }) {
  const ariaLabel = `Decision: ${item.question}. ${item.decision}. Category: ${item.category}. Impact: ${item.impact}. Epic: ${item.epicName}. ${formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}`;
  
  const content = (
    <div className="space-y-2">
      <p className="font-medium text-sm sm:text-base line-clamp-2">{item.question}</p>
      <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">{item.decision}</p>
      <div className="flex items-center gap-1.5 sm:gap-2 text-xs flex-wrap" aria-hidden="true">
        <Badge variant="secondary" className="text-xs flex-shrink-0">
          {item.category}
        </Badge>
        <Badge
          className={`text-xs border-0 flex-shrink-0 ${
            item.impact === 'low'
              ? 'bg-green-100 text-green-700'
              : item.impact === 'medium'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-red-100 text-red-700'
          }`}
        >
          {item.impact}
        </Badge>
        <span className="text-muted-foreground truncate max-w-[150px] sm:max-w-none">{item.epicName}</span>
        <span className="hidden sm:inline">•</span>
        <span className="text-muted-foreground whitespace-nowrap">
          {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
        </span>
      </div>
    </div>
  );

  // If decision is linked to a feature, link to feature page
  if (item.featureIdentifier) {
    return (
      <Link
        to={`/features/${item.featureIdentifier}`}
        className="block border-b py-3 px-3 sm:px-4 hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        aria-label={ariaLabel}
      >
        {content}
      </Link>
    );
  }

  // If decision is linked to an epic (but not a feature), link to epic page
  if (item.epicId) {
    return (
      <Link
        to={`/epics/${item.epicId}`}
        className="block border-b py-3 px-3 sm:px-4 hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        aria-label={ariaLabel}
      >
        {content}
      </Link>
    );
  }

  // Otherwise, render as non-clickable item
  return (
    <div className="border-b py-3 px-3 sm:px-4" role="article" aria-label={ariaLabel}>
      {content}
    </div>
  );
}
