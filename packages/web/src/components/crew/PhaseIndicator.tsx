import { cn } from '@/lib/utils';

interface PhaseIndicatorProps {
  currentPhase: number | null;
  totalPhases: number | null;
  lastCompletedPhase: number | null;
}

export function PhaseIndicator({ currentPhase, totalPhases, lastCompletedPhase }: PhaseIndicatorProps) {
  if (!totalPhases || totalPhases === 0) {
    return (
      <p className="text-xs text-muted-foreground">No phases defined</p>
    );
  }

  const phases = Array.from({ length: totalPhases }, (_, i) => i + 1);

  return (
    <div className="flex items-center gap-1">
      {phases.map((phase) => {
        const isCompleted = lastCompletedPhase !== null && phase <= lastCompletedPhase;
        const isCurrent = phase === currentPhase;

        return (
          <div
            key={phase}
            className={cn(
              'h-2 flex-1 rounded-full transition-colors',
              isCompleted
                ? 'bg-green-500'
                : isCurrent
                  ? 'bg-blue-500 animate-pulse'
                  : 'bg-muted'
            )}
            title={`Phase ${phase}${isCompleted ? ' (completed)' : isCurrent ? ' (in progress)' : ''}`}
          />
        );
      })}
    </div>
  );
}
