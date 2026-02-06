import React from 'react';
import { Eye, Scale, AlertTriangle, ArrowRight, Info, Play, CheckCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export interface ActivityItemProps {
  type: 'observation' | 'decision' | 'blocker' | 'next-step' | 'context' | 'start' | 'complete';
  content: string;
  timestamp: string;
  sessionId?: string;
}

const iconMap = {
  observation: Eye,
  decision: Scale,
  blocker: AlertTriangle,
  'next-step': ArrowRight,
  context: Info,
  start: Play,
  complete: CheckCircle,
};

const colorMap = {
  observation: 'text-gray-500',
  decision: 'text-blue-500',
  blocker: 'text-red-500',
  'next-step': 'text-purple-500',
  context: 'text-cyan-500',
  start: 'text-green-500',
  complete: 'text-green-700',
};

export const ActivityItem: React.FC<ActivityItemProps> = ({ type, content, timestamp }) => {
  const Icon = iconMap[type];
  const color = colorMap[type];
  return (
    <div className="flex items-start gap-3 py-2">
      <span className={`mt-1 ${color}`}>
        <Icon size={20} />
      </span>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium capitalize text-sm">{type.replace('-', ' ')}</span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(timestamp), { addSuffix: true })}
          </span>
        </div>
        <div className="text-sm text-foreground mt-1 whitespace-pre-line">{content}</div>
      </div>
    </div>
  );
};
