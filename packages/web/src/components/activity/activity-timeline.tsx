import React from 'react';
import { ActivityItem } from './activity-item';
import type { ActivityItemProps } from './activity-item';

export interface TimelineEntry {
  id: string;
  type: ActivityItemProps['type'];
  content: string;
  timestamp: string;
  sessionId?: string | undefined;
}

interface ActivityTimelineProps {
  items: TimelineEntry[];
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ items }) => {
  if (!items.length) {
    return (
      <div className="p-4 text-muted-foreground text-center">No activity yet.</div>
    );
  }

  return (
    <div className="relative flex flex-col">
      {items.map((item, idx) => (
        <div
          key={item.id}
          className="relative flex items-start"
        >
          {/* Vertical timeline line */}
          <div className="flex flex-col items-center mr-4">
            <span className="w-3 h-3 rounded-full bg-primary mb-1 mt-2" />
            {idx < items.length - 1 && (
              <span className="w-px flex-1 bg-border" />
            )}
          </div>
          <div className="flex-1 pb-4">
            <ActivityItem
              type={item.type}
              content={item.content}
              timestamp={item.timestamp}
              sessionId={item.sessionId}
            />
          </div>
        </div>
      ))}
    </div>
  );
};
