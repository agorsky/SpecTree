import type { AgentScore } from '@/lib/api/agent-scores';
import { cn } from '@/lib/utils';

function getScoreBadge(score: number): { label: string; className: string } {
  if (score >= 80) return { label: 'Excellent', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' };
  if (score >= 50) return { label: 'Good', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' };
  return { label: 'Needs Work', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' };
}

interface AgentCardProps {
  agent: AgentScore;
}

export function AgentCard({ agent }: AgentCardProps) {
  const badge = getScoreBadge(agent.totalScore);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{agent.agentName}</p>
          <p className="text-xs text-muted-foreground">{agent.agentTitle}</p>
        </div>
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
            badge.className
          )}
        >
          {badge.label}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-lg font-bold tabular-nums">{agent.totalScore}</p>
          <p className="text-[10px] text-muted-foreground">Score</p>
        </div>
        <div>
          <p className="text-lg font-bold tabular-nums text-red-500">{agent.bustsReceived}</p>
          <p className="text-[10px] text-muted-foreground">Busts</p>
        </div>
        <div>
          <p className="text-lg font-bold tabular-nums text-green-500">{agent.cleanCycles}</p>
          <p className="text-[10px] text-muted-foreground">Clean</p>
        </div>
      </div>
    </div>
  );
}
