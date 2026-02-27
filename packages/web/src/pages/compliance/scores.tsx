import { useAgentScores } from '@/hooks/queries/use-agent-scores';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Trophy, Shield } from 'lucide-react';

function scoreColor(score: number): string {
  if (score >= 80) return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
  if (score >= 50) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300';
  return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
}

function rankBadge(rank: number) {
  if (rank === 1) return 'text-amber-500';
  if (rank === 2) return 'text-slate-400';
  if (rank === 3) return 'text-amber-700';
  return 'text-muted-foreground';
}

export function ScoresPage() {
  const { data: scores, isLoading, isError } = useAgentScores();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center text-sm text-destructive">
        Failed to load agent scores. Please try again.
      </div>
    );
  }

  if (!scores || scores.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No agent scores recorded yet</p>
      </div>
    );
  }

  const isBarney = (name: string) => name.toLowerCase() === 'barney';

  return (
    <div className="rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left px-4 py-3 font-medium w-16">Rank</th>
            <th className="text-left px-4 py-3 font-medium">Agent</th>
            <th className="text-left px-4 py-3 font-medium">Title</th>
            <th className="text-left px-4 py-3 font-medium">Score</th>
            <th className="text-left px-4 py-3 font-medium">Busts Received</th>
            <th className="text-left px-4 py-3 font-medium">Clean Cycles</th>
            <th className="text-left px-4 py-3 font-medium">Special</th>
          </tr>
        </thead>
        <tbody>
          {scores.map((agent, index) => (
            <tr
              key={agent.id}
              className={cn(
                'border-b last:border-b-0 transition-colors',
                isBarney(agent.agentName)
                  ? 'bg-blue-50/50 dark:bg-blue-950/20'
                  : 'hover:bg-accent/50'
              )}
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-1">
                  {index < 3 ? (
                    <Trophy className={cn('h-4 w-4', rankBadge(index + 1))} />
                  ) : (
                    <span className="text-muted-foreground pl-0.5">{index + 1}</span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  {isBarney(agent.agentName) && (
                    <Shield className="h-4 w-4 text-blue-500" />
                  )}
                  <span className="font-medium">{agent.agentName}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{agent.agentTitle}</td>
              <td className="px-4 py-3">
                <Badge className={cn('text-xs tabular-nums', scoreColor(agent.totalScore))}>
                  {agent.totalScore}
                </Badge>
              </td>
              <td className="px-4 py-3 tabular-nums">{agent.bustsReceived}</td>
              <td className="px-4 py-3 tabular-nums">{agent.cleanCycles}</td>
              <td className="px-4 py-3">
                {isBarney(agent.agentName) ? (
                  <div className="flex items-center gap-3 text-xs">
                    <span>
                      Convictions: <span className="font-medium">{agent.bustsIssued}</span>
                    </span>
                    {agent.falseBusts !== undefined && agent.falseBusts > 0 && (
                      <span className="text-destructive">
                        False busts: <span className="font-medium">{agent.falseBusts}</span>
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
