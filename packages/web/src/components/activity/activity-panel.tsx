import React from 'react';
import { useFeatureAiContext, useTaskAiContext } from '@/hooks/queries/use-ai-context';
import { useFeatureChangelog, useTaskChangelog } from '@/hooks/queries/use-changelog';
import { ActivityTimeline } from './activity-timeline';
import type { TimelineEntry } from './activity-timeline';
import type { AiNote } from '@/lib/api/ai-types';
import type { ChangeLogEntry } from '@/lib/api/changelog';

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

function mapNoteType(noteType: AiNote['type']): TimelineEntry['type'] {
  return noteType;
}

/**
 * Convert a changelog entry to a timeline entry
 */
function changelogToTimelineEntry(change: ChangeLogEntry): TimelineEntry {
  return {
    id: `changelog-${change.id}`,
    type: 'change',
    content: '', // Not used for changelog entries
    timestamp: change.changedAt,
    field: change.field,
    oldValue: change.oldValue,
    newValue: change.newValue,
  };
}

export const ActivityPanel: React.FC<ActivityPanelProps> = ({ featureId, taskId }) => {
  const featureAiQuery = useFeatureAiContext(featureId ?? '');
  const taskAiQuery = useTaskAiContext(taskId ?? '');
  
  const featureChangelogQuery = useFeatureChangelog(featureId ?? '', { limit: 50 });
  const taskChangelogQuery = useTaskChangelog(taskId ?? '', { limit: 50 });

  // Select the appropriate queries based on whether it's a feature or task
  const aiQuery = featureId ? featureAiQuery : taskAiQuery;
  const changelogQuery = featureId ? featureChangelogQuery : taskChangelogQuery;
  
  const aiNotes: AiNote[] = aiQuery.data?.aiNotes ?? [];
  const changelogEntries: ChangeLogEntry[] = changelogQuery.data?.data ?? [];

  // Convert AI notes to timeline entries
  const aiTimelineEntries: TimelineEntry[] = aiNotes.map((note) => ({
    id: `ai-${note.timestamp}-${note.type}`,
    type: mapNoteType(note.type),
    content: note.content,
    timestamp: note.timestamp,
    sessionId: note.sessionId,
  }));
  
  // Convert changelog entries to timeline entries
  const changelogTimelineEntries: TimelineEntry[] = changelogEntries.map(changelogToTimelineEntry);
  
  // Merge and sort all entries by timestamp (newest first)
  const activityItems: TimelineEntry[] = [...aiTimelineEntries, ...changelogTimelineEntries]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Loading state: show skeleton if either query is loading
  if (aiQuery.isLoading || changelogQuery.isLoading) {
    return <ActivitySkeleton />;
  }
  
  // Error state: show error if either query failed
  if (aiQuery.isError || changelogQuery.isError) {
    return (
      <div className="p-4 text-destructive text-sm text-center">
        Failed to load activity data
      </div>
    );
  }
  
  // Empty state
  if (!activityItems.length) {
    return <ActivityEmpty />;
  }

  return <ActivityTimeline items={activityItems} />;
};
