import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { useActivityDetails } from '@/hooks/queries/use-activity-details';
import type { ActivityInterval, ActivityScope } from '@/lib/api/user-activity';
import type {
  FeatureDetail,
  TaskDetail,
  DecisionDetail,
  SessionDetail,
} from '@/lib/api/user-activity-details';
import {
  FileQuestion,
  CheckCircle2,
  Lightbulb,
  Bot,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  FeatureDetailList,
  TaskDetailList,
  DecisionDetailList,
  SessionDetailList,
} from './detail-lists';

interface MetricDetailSheetProps {
  metricType: 'features' | 'tasks' | 'decisions' | 'sessions';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  interval: ActivityInterval;
  page: number;
  scope: ActivityScope;
  scopeId?: string;
  timeZone: string;
}

const METRIC_TITLES: Record<MetricDetailSheetProps['metricType'], string> = {
  features: 'Features Created',
  tasks: 'Tasks Completed',
  decisions: 'Decisions Logged',
  sessions: 'AI Sessions',
} as const;

const METRIC_COLORS: Record<MetricDetailSheetProps['metricType'], string> = {
  features: 'text-blue-600',
  tasks: 'text-green-600',
  decisions: 'text-amber-600',
  sessions: 'text-purple-600',
} as const;

const EMPTY_MESSAGES: Record<MetricDetailSheetProps['metricType'], { message: string; icon: React.ComponentType<{ className?: string }> }> = {
  features: {
    message: 'No features were created during this period',
    icon: FileQuestion,
  },
  tasks: {
    message: 'No tasks were completed during this period',
    icon: CheckCircle2,
  },
  decisions: {
    message: 'No decisions were logged during this period',
    icon: Lightbulb,
  },
  sessions: {
    message: 'No AI sessions were recorded during this period',
    icon: Bot,
  },
} as const;

function SkeletonItem() {
  return (
    <div className="border-b py-3 px-4">
      <div className="space-y-2">
        <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
        <div className="h-3 bg-muted animate-pulse rounded w-1/2" />
      </div>
    </div>
  );
}

export function MetricDetailSheet({
  metricType,
  open,
  onOpenChange,
  interval,
  page,
  scope,
  scopeId,
  timeZone,
}: MetricDetailSheetProps) {
  // Track the current metricType to detect rapid switching
  const [currentMetricType, setCurrentMetricType] = useState(metricType);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Handle rapid switching: clear transition state when metricType changes
  useEffect(() => {
    if (metricType !== currentMetricType) {
      setIsTransitioning(true);
      setCurrentMetricType(metricType);
      // Clear transition after a brief delay to show loading state
      const timer = setTimeout(() => setIsTransitioning(false), 50);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [metricType, currentMetricType]);

  const { data, isLoading, error, refetch } = useActivityDetails({
    metricType,
    interval,
    page,
    scope,
    ...(scopeId !== undefined && { scopeId }),
    timeZone,
    enabled: open,
  });

  const title = METRIC_TITLES[metricType];
  const color = METRIC_COLORS[metricType];
  const emptyConfig = EMPTY_MESSAGES[metricType];
  const EmptyIcon = emptyConfig.icon;
  const itemCount = data?.data?.length ?? 0;

  // Show loading during transition or actual loading
  const showLoading = isLoading || isTransitioning;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md md:max-w-lg lg:max-w-xl overflow-y-auto p-0 flex flex-col"
        aria-label={`${title} detail view`}
      >
        <SheetHeader className="px-4 sm:px-6 py-4 border-b sticky top-0 bg-background z-10">
          <SheetTitle className={`${color} flex items-center justify-between gap-2`}>
            <span className="truncate">{title}</span>
            {itemCount > 0 && (
              <span className="text-sm font-normal text-muted-foreground flex-shrink-0" aria-label={`${itemCount} total items`}>
                {itemCount} {itemCount === 1 ? 'item' : 'items'}
              </span>
            )}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Detailed list of {title.toLowerCase()} for the selected period. Use arrow keys to navigate through items, Enter to select.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto" role="region" aria-label={`${title} list`}>
          {/* Loading state */}
          {showLoading && (
            <div className="space-y-0" role="status" aria-live="polite" aria-label="Loading content">
              {Array.from({ length: 5 }).map((_, idx) => (
                <SkeletonItem key={idx} />
              ))}
              <span className="sr-only">Loading {metricType}...</span>
            </div>
          )}

          {/* Error state */}
          {error && !showLoading && (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center" role="alert" aria-live="assertive">
              <p className="text-muted-foreground mb-4">
                Failed to load {metricType}. Please try again.
              </p>
              <Button onClick={() => { void refetch(); }} variant="outline" aria-label="Retry loading">
                Try again
              </Button>
            </div>
          )}

          {/* Empty state */}
          {!showLoading && !error && data?.data.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center" role="status">
              <EmptyIcon className="h-12 w-12 text-muted-foreground/50 mb-3" aria-hidden="true" />
              <p className="text-muted-foreground text-sm">{emptyConfig.message}</p>
            </div>
          )}

          {/* Data list */}
          {!showLoading && !error && data?.data && data.data.length > 0 && (
            <nav aria-label={`${title} navigation`}>
              {metricType === 'features' && (
                <FeatureDetailList items={data.data as FeatureDetail[]} />
              )}
              {metricType === 'tasks' && (
                <TaskDetailList items={data.data as TaskDetail[]} />
              )}
              {metricType === 'decisions' && (
                <DecisionDetailList items={data.data as DecisionDetail[]} />
              )}
              {metricType === 'sessions' && (
                <SessionDetailList items={data.data as SessionDetail[]} />
              )}
            </nav>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
