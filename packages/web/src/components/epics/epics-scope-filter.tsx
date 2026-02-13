import { ScopeSelector, type ScopeMode } from '@/components/common/scope-selector';

export interface EpicsScopeFilterProps {
  /**
   * The current scope mode selected
   */
  scope: ScopeMode;
  
  /**
   * The ID of the selected team or user (when scope is 'team' or 'user')
   */
  scopeId?: string;
  
  /**
   * Callback when the scope or scopeId changes
   */
  onScopeChange: (scope: ScopeMode, scopeId?: string) => void;
}

/**
 * Epics page-specific scope filter.
 * Wraps the shared ScopeSelector with "Epics" as the entity label.
 * Renders dropdown with: My Epics, All Epics, By Team, By User
 */
export function EpicsScopeFilter({ scope, scopeId, onScopeChange }: EpicsScopeFilterProps) {
  return (
    <ScopeSelector
      scope={scope}
      {...(scopeId !== undefined && { scopeId })}
      onScopeChange={onScopeChange}
      entityLabel="Epics"
    />
  );
}
