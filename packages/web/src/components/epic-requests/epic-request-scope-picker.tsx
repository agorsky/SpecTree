import { User, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

export type EpicRequestScope = 'personal' | 'team';

interface EpicRequestScopePickerProps {
  /**
   * The currently selected scope
   */
  scope: EpicRequestScope;

  /**
   * Callback when the scope changes
   */
  onScopeChange: (scope: EpicRequestScope) => void;

  /**
   * Whether the picker is disabled
   */
  disabled?: boolean;
}

/**
 * Simple toggle picker for choosing between Personal and Team scope
 * when creating an epic request. Uses button-group styling consistent
 * with existing Tailwind/shadcn patterns in the codebase.
 */
export function EpicRequestScopePicker({
  scope,
  onScopeChange,
  disabled = false,
}: EpicRequestScopePickerProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium leading-none">Scope</label>
      <div className="flex rounded-md border border-input overflow-hidden">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onScopeChange('team')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors flex-1 justify-center',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            scope === 'team'
              ? 'bg-primary text-primary-foreground'
              : 'bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )}
        >
          <Users className="h-4 w-4" />
          Team
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onScopeChange('personal')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors flex-1 justify-center border-l border-input',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            scope === 'personal'
              ? 'bg-primary text-primary-foreground'
              : 'bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )}
        >
          <User className="h-4 w-4" />
          Personal
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        {scope === 'personal'
          ? 'Personal requests are auto-approved and visible only to you.'
          : 'Team requests go through the normal approval workflow.'}
      </p>
    </div>
  );
}
