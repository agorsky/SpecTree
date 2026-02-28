import { useState } from 'react';
import { useEpics } from '@/hooks/queries/use-epics';
import { useAllActiveSessions } from '@/hooks/queries/use-crew-sessions';
import { SessionCard } from './SessionCard';
import { Radio } from 'lucide-react';

export function LiveSessionsPanel() {
  const { data: epicsData, isLoading: epicsLoading } = useEpics();

  const epicIds = epicsData?.pages.flatMap((p) => p.data.map((e) => e.id)) ?? [];
  const { data: sessions, isLoading: sessionsLoading } = useAllActiveSessions(epicIds);

  const isLoading = epicsLoading || sessionsLoading;

  if (isLoading) {
    return (
      <div className="space-y-4 pt-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-lg border bg-muted/50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!sessions || sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Radio className="h-10 w-10 text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">No active sessions</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Sessions will appear here when agents start working
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
      {sessions.map((session) => (
        <SessionCard key={session.id} session={session} />
      ))}
    </div>
  );
}
