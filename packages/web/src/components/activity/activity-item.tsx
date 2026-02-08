import React from 'react';
import { Eye, Scale, AlertTriangle, ArrowRight, Info, Play, CheckCircle, Edit } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export interface ActivityItemProps {
  type: 'observation' | 'decision' | 'blocker' | 'next-step' | 'context' | 'start' | 'complete' | 'change';
  content: string;
  timestamp: string;
  sessionId?: string | undefined;
  // Additional props for changelog entries
  field?: string | undefined;
  oldValue?: string | null | undefined;
  newValue?: string | null | undefined;
}

const iconMap = {
  observation: Eye,
  decision: Scale,
  blocker: AlertTriangle,
  'next-step': ArrowRight,
  context: Info,
  start: Play,
  complete: CheckCircle,
  change: Edit,
};

const colorMap = {
  observation: 'text-gray-500',
  decision: 'text-blue-500',
  blocker: 'text-red-500',
  'next-step': 'text-purple-500',
  context: 'text-cyan-500',
  start: 'text-green-500',
  complete: 'text-green-700',
  change: 'text-orange-500',
};

/**
 * Format a field name from camelCase to human-readable format
 * e.g., "statusId" -> "Status"
 */
function formatFieldName(field: string): string {
  // Handle common field name patterns
  if (field === 'statusId') return 'Status';
  if (field === 'assigneeId') return 'Assignee';
  if (field === 'epicId') return 'Epic';
  
  // Convert camelCase to Title Case
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

/**
 * Format a value for display (parse JSON if needed, handle nulls)
 */
function formatValue(value: string | null | undefined): string {
  if (value === null || value === undefined) return 'None';
  
  try {
    // Try to parse JSON
    const parsed = JSON.parse(value);
    
    // Handle different types
    if (typeof parsed === 'string') return parsed;
    if (typeof parsed === 'number') return parsed.toString();
    if (typeof parsed === 'boolean') return parsed ? 'Yes' : 'No';
    if (parsed === null) return 'None';
    
    // For objects/arrays, return a readable string
    return JSON.stringify(parsed);
  } catch {
    // If not valid JSON, return as-is
    return value;
  }
}

export const ActivityItem: React.FC<ActivityItemProps> = ({ 
  type, 
  content, 
  timestamp, 
  field, 
  oldValue, 
  newValue 
}) => {
  const Icon = iconMap[type];
  const color = colorMap[type];
  
  // Special rendering for changelog entries
  if (type === 'change' && field) {
    const fieldLabel = formatFieldName(field);
    const oldValueFormatted = formatValue(oldValue);
    const newValueFormatted = formatValue(newValue);
    
    return (
      <div className="flex items-start gap-3 py-2 px-3 rounded-md bg-orange-50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/30">
        <span className={`mt-1 ${color}`}>
          <Icon size={20} />
        </span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-orange-900 dark:text-orange-100">
              Changed {fieldLabel}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(timestamp), { addSuffix: true })}
            </span>
          </div>
          <div className="text-sm mt-1 flex items-center gap-2">
            <span className="text-muted-foreground/70 line-through">{oldValueFormatted}</span>
            <span className="text-orange-600 dark:text-orange-400 font-bold">→</span>
            <span className="text-foreground font-semibold">{newValueFormatted}</span>
          </div>
        </div>
      </div>
    );
  }
  
  // Standard rendering for AI notes
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
