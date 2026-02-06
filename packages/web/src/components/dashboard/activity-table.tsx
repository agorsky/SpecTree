import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { UserActivityDataPoint } from '@/lib/api/user-activity';
import type { ActivityInterval } from '@/lib/api/user-activity';

interface ActivityTableProps {
  data: UserActivityDataPoint[];
  interval: ActivityInterval;
}

function formatDate(isoDate: string, interval: ActivityInterval): string {
  const d = new Date(isoDate);
  if (interval === 'day') {
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }
  if (interval === 'week') {
    const end = new Date(d);
    end.setDate(end.getDate() + 6);
    return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  }
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function ActivityTable({ data, interval }: ActivityTableProps) {
  // Reverse so most recent first
  const sorted = [...data];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Activity Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left py-2 px-2 font-medium">Period</th>
                <th className="text-right py-2 px-2 font-medium">Features</th>
                <th className="text-right py-2 px-2 font-medium">Tasks</th>
                <th className="text-right py-2 px-2 font-medium">Decisions</th>
                <th className="text-right py-2 px-2 font-medium">Sessions</th>
                <th className="text-right py-2 px-2 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((point, idx) => (
                <tr
                  key={idx}
                  className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                >
                  <td className="py-2 px-2">
                    {formatDate(point.intervalStart, interval)}
                  </td>
                  <td className="text-right py-2 px-2 tabular-nums">
                    {point.featuresCreated || '—'}
                  </td>
                  <td className="text-right py-2 px-2 tabular-nums">
                    {point.tasksCompleted || '—'}
                  </td>
                  <td className="text-right py-2 px-2 tabular-nums">
                    {point.decisionsLogged || '—'}
                  </td>
                  <td className="text-right py-2 px-2 tabular-nums">
                    {point.aiSessions || '—'}
                  </td>
                  <td className="text-right py-2 px-2 font-medium tabular-nums">
                    {point.totalActivity}
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No activity recorded yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
