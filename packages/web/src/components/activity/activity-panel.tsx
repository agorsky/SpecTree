import React from 'react';

// Assume these hooks are available from ENG-62
// import { useFeatureAiContext } from '../../hooks/useFeatureAiContext';
// import { useTaskAiContext } from '../../hooks/useTaskAiContext';

// ActivityItem type
export interface ActivityItem {
  id: string;
  type: 'observation' | 'decision' | 'blocker' | 'next-step' | 'context';
  content: string;
  timestamp: string;
}

interface ActivityPanelProps {
  featureId?: string;
  taskId?: string;
}

// Skeleton and empty state components
const ActivitySkeleton = () => (
  <div className="animate-pulse p-4 border rounded bg-muted">Loading activity...</div>
);

const ActivityEmpty = () => (
  <div className="p-4 text-muted-foreground text-center">No activity yet.</div>
);

// Main wrapper
export const ActivityPanel: React.FC<ActivityPanelProps> = ({ featureId: _featureId, taskId: _taskId }) => {
  // Stubbed hook usage
  // const { aiNotes, loading } = _featureId
  //   ? useFeatureAiContext(_featureId)
  //   : _taskId
  //   ? useTaskAiContext(_taskId)
  //   : { aiNotes: [], loading: false };

  // Temporary stub for demo
  const loading = false;
  const aiNotes: any[] = [];

  // Transform AI notes to ActivityItem format
  const activityItems: ActivityItem[] = aiNotes
    .map((note: any) => ({
      id: note.id || note.timestamp,
      type: note.type,
      content: note.content,
      timestamp: note.timestamp,
    }))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (loading) return <ActivitySkeleton />;
  if (!activityItems.length) return <ActivityEmpty />;

  // Placeholder for timeline component
  return (
    <div className="space-y-2">
      {/* ActivityTimeline will be rendered here */}
      {activityItems.map(item => (
        <div key={item.id} className="border rounded p-2">
          <div className="font-semibold">[{item.type}] {item.content}</div>
          <div className="text-xs text-muted-foreground">{item.timestamp}</div>
        </div>
      ))}
    </div>
  );
};
