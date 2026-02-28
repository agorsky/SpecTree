import { useAgentScores } from '@/hooks/queries/use-agent-scores';
import { AgentCard } from './AgentCard';
import { Bot } from 'lucide-react';

export function AgentStatusPanel() {
  const { data: agents, isLoading, isError } = useAgentScores();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 rounded-lg border bg-muted/50 animate-pulse" />
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

  if (!agents || agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Bot className="h-10 w-10 text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">No agents registered</p>
      </div>
    );
  }

  const sorted = [...agents].sort((a, b) => b.totalScore - a.totalScore);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
      {sorted.map((agent) => (
        <AgentCard key={agent.id} agent={agent} />
      ))}
    </div>
  );
}
