import { useState } from 'react';
import { useUserActivity } from '@/hooks/queries/use-user-activity';
import type { ActivityInterval, ActivityScope } from '@/lib/api/user-activity';
import { IntervalSelector } from '@/components/dashboard/interval-selector';
import { ScopeSelector } from '@/components/dashboard/scope-selector';
import { ActivityChart } from '@/components/dashboard/activity-chart';
import { ActivityTable } from '@/components/dashboard/activity-table';
import { ExportMenu } from '@/components/dashboard/export-menu';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';

export function DashboardPage() {
  const [interval, setInterval] = useState<ActivityInterval>('week');
  const [page, setPage] = useState(1);
  const [scope, setScope] = useState<ActivityScope>('self');
  const [scopeId, setScopeId] = useState<string | undefined>(undefined);

  const isGlobalAdmin = useAuthStore((s) => s.user?.isGlobalAdmin ?? false);

  const { data, isLoading, isError, dataUpdatedAt, isFetching } = useUserActivity(
    interval,
    page,
    14,
    scope,
    scopeId
  );

  // Reset page when interval changes
  const handleIntervalChange = (newInterval: ActivityInterval) => {
    setInterval(newInterval);
    setPage(1);
  };

  // Reset page when scope changes
  const handleScopeChange = (newScope: ActivityScope, newScopeId?: string) => {
    setScope(newScope);
    setScopeId(newScopeId);
    setPage(1);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Activity Dashboard</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-muted-foreground">
              Your activity across features, tasks, decisions, and AI sessions
            </p>
            {dataUpdatedAt > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground/70">
                <RefreshCw className={`h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} />
                {new Date(dataUpdatedAt).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {data && <ExportMenu data={data.data} interval={interval} />}
          {isGlobalAdmin && (
            <ScopeSelector
              scope={scope}
              {...(scopeId !== undefined && { scopeId })}
              onScopeChange={handleScopeChange}
            />
          )}
          <IntervalSelector value={interval} onChange={handleIntervalChange} />
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-4">
          <div className="h-64 rounded-lg border bg-muted/50 animate-pulse" />
          <div className="h-48 rounded-lg border bg-muted/50 animate-pulse" />
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center text-sm text-destructive">
          Failed to load activity data. Please try again.
        </div>
      )}

      {/* Content */}
      {data && !isLoading && (
        <>
          {/* Summary cards */}
          <SummaryCards data={data.data} />

          {/* Chart */}
          <ActivityChart data={data.data} interval={interval} />

          {/* Table */}
          <ActivityTable data={data.data} interval={interval} />

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {data.page} of {Math.ceil(data.total / data.limit)}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Newer
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={!data.hasMore}
              >
                Older
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCards({ data }: { data: import('@/lib/api/user-activity').UserActivityDataPoint[] }) {
  const totals = data.reduce(
    (acc, d) => ({
      features: acc.features + d.featuresCreated,
      tasks: acc.tasks + d.tasksCompleted,
      decisions: acc.decisions + d.decisionsLogged,
      sessions: acc.sessions + d.aiSessions,
    }),
    { features: 0, tasks: 0, decisions: 0, sessions: 0 }
  );

  const cards = [
    { label: 'Features Created', value: totals.features, color: 'text-blue-600' },
    { label: 'Tasks Completed', value: totals.tasks, color: 'text-green-600' },
    { label: 'Decisions Logged', value: totals.decisions, color: 'text-amber-600' },
    { label: 'AI Sessions', value: totals.sessions, color: 'text-purple-600' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-lg border bg-card p-4 text-center"
        >
          <p className={`text-2xl font-bold tabular-nums ${card.color}`}>
            {card.value}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{card.label}</p>
        </div>
      ))}
    </div>
  );
}
