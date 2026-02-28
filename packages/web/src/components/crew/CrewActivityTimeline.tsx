import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useEpics } from '@/hooks/queries/use-epics';
import { useAgentScores } from '@/hooks/queries/use-agent-scores';
import { sessionsApi } from '@/lib/api/sessions';
import { sessionEventKeys } from '@/hooks/queries/session-event-keys';
import { TimelineFilters } from './TimelineFilters';
import { Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

export function CrewActivityTimeline() {
  const [selectedEpicId, setSelectedEpicId] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('');

  const { data: epicsData, isLoading: epicsLoading } = useEpics();
  const epics = epicsData?.pages.flatMap((p) => p.data) ?? [];

  const { data: agents } = useAgentScores();
  const agentNames = useMemo(() => agents?.map((a) => a.agentName) ?? [], [agents]);

  // Fetch events for selected epic (or first epic)
  const epicIdForEvents = selectedEpicId || epics[0]?.id || '';

  const { data: eventsData, isLoading: eventsLoading } = useQuery({
    queryKey: sessionEventKeys.events(epicIdForEvents, {}),
    queryFn: () => sessionsApi.getEvents(epicIdForEvents, { limit: 50 }),
    enabled: !!epicIdForEvents,
    refetchInterval: 5000,
  });

  const events = eventsData?.data?.events ?? [];

  const filteredEvents = useMemo(() => {
    if (!selectedAgent) return events;
    return events.filter((e) => {
      const meta = e.metadata as Record<string, unknown> | undefined;
      return meta?.agentName === selectedAgent;
    });
  }, [events, selectedAgent]);

  const isLoading = epicsLoading || eventsLoading;

  if (isLoading) {
    return (
      <div className="space-y-4 pt-4">
        <div className="h-10 w-64 rounded border bg-muted/50 animate-pulse" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 rounded-lg border bg-muted/50 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-4">
      <TimelineFilters
        epics={epics}
        selectedEpicId={selectedEpicId}
        onEpicChange={setSelectedEpicId}
        agents={agentNames}
        selectedAgent={selectedAgent}
        onAgentChange={setSelectedAgent}
      />

      {filteredEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Activity className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">No activity events</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Events will appear as agents perform work
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredEvents.map((event, idx) => {
            const meta = event.metadata as Record<string, unknown> | undefined;
            return (
              <div
                key={`${event.sessionId}-${event.timestamp}-${idx}`}
                className="flex items-start gap-3 rounded-lg border bg-card p-3"
              >
                <div
                  className={cn(
                    'mt-1 h-2 w-2 rounded-full shrink-0',
                    event.eventType === 'SESSION_STARTED'
                      ? 'bg-green-500'
                      : event.eventType === 'SESSION_ENDED'
                        ? 'bg-muted-foreground'
                        : event.eventType === 'SESSION_TASK_COMPLETED'
                          ? 'bg-blue-500'
                          : 'bg-amber-500'
                  )}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{event.eventType}</p>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  {meta?.message && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {String(meta.message)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
