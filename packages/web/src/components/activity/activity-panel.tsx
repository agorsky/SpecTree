import React from 'react';
import { useFeatureAiContext, useTaskAiContext } from '@/hooks/queries/use-ai-context';
import { ActivityTimeline } from './activity-timeline';
import type { TimelineEntry } from './activity-timeline';
import type { AiNote } from '@/lib/api/ai-types';

interface ActivityPanelProps {
  featureId?: string;
  taskId?: string;
}

const ActivitySkeleton = () => (
  <div className="space-y-4 p-4">
    {[1, 2, 3].map((i) => (
      <div key={i} className="flex gap-3 animate-pulse">
        <div className="w-3 h-3 rounded-full bg-muted mt-2" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="h-4 w-full bg-muted rounded" />
        </div>
      </div>
    ))}
  </div>
);

const ActivityEmpty = () => (
  <div className="p-8 text-muted-foreground text-center text-sm">
    No activity recorded yet. Activity is populated when AI agents work on this item.
  </div>
);

function mapNoteType(noteType: AiNote['noteType']): TimelineEntry['type'] {
  return noteType;
}

export const ActivityPanel: React.FC<ActivityPanelProps> = ({ featureId, taskId }) => {
  const featureQuery = useFeatureAiContext(featureId ?? '');
  const taskQuery = useTaskAiContext(taskId ?? '');

  const query = featureId ? featureQuery : taskQuery;
  const aiNotes: AiNote[] = query.data?.aiNotes ?? [];

  const activityItems: TimelineEntry[] = aiNotes
    .map((note) => ({
      id: `${note.timestamp}-${note.noteType}`,
      type: mapNoteType(note.noteType),
      content: note.content,
      timestamp: note.timestamp,
      sessionId: note.sessionId,
    }))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (query.isLoading) return <ActivitySkeleton />;
  if (query.isError) {
    return (
      <div className="p-4 text-destructive text-sm text-center">
        Failed to load activity data
      </div>
    );
  }
  if (!activityItems.length) return <ActivityEmpty />;

  return <ActivityTimeline items={activityItems} />;
};
