import React from 'react';
import type { ActivityItem } from './activity-panel';

interface ActivityTimelineProps {
  items: ActivityItem[];
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
          {/* Vertical line: only render for all but last item */}
          <div className="flex flex-col items-center mr-4">
            <span className="w-3 h-3 rounded-full bg-primary mb-1" />
            {idx < items.length - 1 && (
              <span
                className="w-px h-8 bg-muted-foreground"
                style={{ marginTop: 0 }}
              />
            )}
          </div>
          {/* ActivityItem placeholder: replace with ActivityItem component when available */}
          <div className="flex-1 border rounded p-2">
            <div className="font-semibold">[{item.type}] {item.content}</div>
            <div className="text-xs text-muted-foreground">{item.timestamp}</div>
          </div>
        </div>
      ))}
    </div>
  );
};
