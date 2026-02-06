import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { UserActivityDataPoint } from '@/lib/api/user-activity';
import type { ActivityInterval } from '@/lib/api/user-activity';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ActivityChartProps {
  data: UserActivityDataPoint[];
  interval: ActivityInterval;
}

function formatLabel(isoDate: string, interval: ActivityInterval): string {
  const d = new Date(isoDate);
  if (interval === 'day') {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  if (interval === 'week') {
    return `W${getWeekNumber(d)}`;
  }
  return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
}

function getWeekNumber(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1);
  const diff = d.getTime() - start.getTime();
  return Math.ceil((diff / 86400000 + start.getDay() + 1) / 7);
}

const categories = [
  { key: 'featuresCreated' as const, label: 'Features', color: 'bg-blue-500' },
  { key: 'tasksCompleted' as const, label: 'Tasks', color: 'bg-green-500' },
  { key: 'decisionsLogged' as const, label: 'Decisions', color: 'bg-amber-500' },
  { key: 'aiSessions' as const, label: 'AI Sessions', color: 'bg-purple-500' },
];

export function ActivityChart({ data, interval }: ActivityChartProps) {
  // Reverse so oldest is on the left
  const sorted = [...data].reverse();
  const maxTotal = Math.max(1, ...sorted.map((d) => d.totalActivity));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Activity Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-4 text-xs">
          {categories.map((cat) => (
            <div key={cat.key} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-sm ${cat.color}`} />
              <span className="text-muted-foreground">{cat.label}</span>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="flex items-end gap-1 h-48">
          {sorted.map((point, idx) => {
            return (
              <TooltipProvider key={idx}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex flex-col-reverse" style={{ height: '160px' }}>
                        {categories.map((cat) => {
                          const val = point[cat.key];
                          if (val === 0) return null;
                          const segPct = (val / maxTotal) * 100;
                          return (
                            <div
                              key={cat.key}
                              className={`w-full ${cat.color} first:rounded-b last:rounded-t transition-all`}
                              style={{ height: `${segPct}%` }}
                            />
                          );
                        })}
                        {point.totalActivity === 0 && (
                          <div className="w-full bg-muted rounded" style={{ height: '2px' }} />
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground truncate w-full text-center">
                        {formatLabel(point.intervalStart, interval)}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs space-y-0.5">
                      <p className="font-medium">{formatLabel(point.intervalStart, interval)}</p>
                      {categories.map((cat) => (
                        <p key={cat.key}>
                          {cat.label}: {point[cat.key]}
                        </p>
                      ))}
                      <p className="font-medium border-t pt-0.5 mt-1">
                        Total: {point.totalActivity}
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>

        {sorted.length === 0 && (
          <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
            No activity data to display
          </div>
        )}
      </CardContent>
    </Card>
  );
}
